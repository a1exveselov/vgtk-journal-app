import test from 'node:test';
import assert from 'node:assert/strict';
import { BELL_SLOTS, normalizeScheduleDay, readSchedule } from '../src/data/scheduleRepository.js';

const slot = num => ({ num, time: BELL_SLOTS[num - 1].start + ' - ' + BELL_SLOTS[num - 1].end });
const lesson = (id, numbers, fields = {}) => ({
  id, subject: id, group: 'ПО-31', slots: numbers.map(slot), ...fields
});
const normalize = (lessons, options = {}, dayFields = {}) => normalizeScheduleDay('today',
  { lessons, ...dayFields }, options);
const spans = items => items.map(i => i.start + '–' + i.end);

test('all ten official bell intervals, 45 minutes per slot', () => {
  assert.deepEqual(spans(BELL_SLOTS), ['09:00–09:45', '09:55–10:40', '10:50–11:35', '11:45–12:30',
    '12:40–13:25', '13:35–14:20', '14:30–15:15', '15:25–16:10', '16:20–17:05', '17:15–18:00']);
});

test('acceptance day: four lessons, six academic hours, distinct internal and external breaks', () => {
  const day = normalize([
    lesson('Физкультура', [3]), lesson('Русский язык', [4]), lesson('Обед', [5]),
    lesson('Биология', [6, 7]), lesson('География', [8, 9])
  ]);
  assert.equal(day.status, 'ready');
  assert.deepEqual(day.summary, { count: 4, hours: 6, end: '17:05' });
  assert.deepEqual(spans(day.lessons), ['10:50–11:35', '11:45–12:30', '12:40–13:25', '13:35–15:15', '15:25–17:05']);
  assert.equal(day.lessons[2].isLunch, true);
  assert.deepEqual(spans(day.timeline.filter(i => i.kind === 'break')), ['11:35–11:45', '12:30–12:40', '13:25–13:35', '15:15–15:25']);
  const internal = day.lessons.flatMap(l => l.parts.filter(p => p.kind === 'break'));
  assert.deepEqual(spans(internal), ['14:20–14:30', '16:10–16:20']);
  assertCoveredOnce(day.timeline);
});

function assertCoveredOnce(timeline) {
  const parts = timeline.flatMap(item => item.parts ?? [item]);
  for (let i = 0; i < parts.length; i++) {
    assert.ok(parts[i].start < parts[i].end);
    if (i) assert.equal(parts[i - 1].end, parts[i].start);
  }
}

test('separate same-subject records, trailing lunch and inconsistent hoursCount', () => {
  const day = normalize([lesson('a', [1], { subject: 'Физика', hoursCount: 2 }),
    lesson('b', [2], { subject: 'Физика' }), lesson('c', [3], { isLunch: true })]);
  assert.deepEqual(day.summary, { count: 2, hours: 2, end: '10:40' });
  assert.ok(day.warnings.length);
  assert.deepEqual(day.lessons.map(l => l.id), ['a', 'b', 'c']);
  assert.deepEqual(normalize([lesson('Обед', [5])]).summary, { count: 0, hours: 0, end: null });
});

test('one or several covered free slots, with all minutes accounted for once', () => {
  for (const last of [5, 7]) {
    const rows = [lesson('a', [3]), lesson('b', [last])];
    const day = normalize(rows, { source: 'demo' });
    assert.deepEqual(day.timeline.map(i => i.kind), ['lesson', 'break', 'window', 'break', 'lesson']);
    const window = day.timeline[2];
    assert.deepEqual(window.slots.map(s => s.num), BELL_SLOTS.slice(3, last - 1).map(s => s.num));
    assert.equal(window.parts.filter(p => p.kind === 'break').length, last - 5);
    assert.deepEqual(day.summary, { hours: 2, count: 2, end: BELL_SLOTS[last - 1].end });
    assertCoveredOnce(day.timeline);
    assert.equal(normalize(rows, { source: 'live' }, { complete: true }).timeline[2].kind, 'window');
    for (const source of ['demo', 'live', 'unknown']) {
      const partial = normalize(rows, { source }, { complete: false });
      assert.deepEqual(partial.timeline.map(i => i.kind), ['lesson', 'gap', 'lesson']);
      assertCoveredOnce(partial.timeline);
    }
  }
});

test('alternate clocks preserved, no synthetic windows or standard breaks without confirmation', () => {
  const early = lesson('a', [1], { slots: [{ num: 1, time: '08.50 - 09.35' }] });
  for (const next of [2, 4]) {
    const day = normalize([early, lesson('b', [next])], { source: 'demo' });
    assert.equal(day.status, 'ready');
    assert.deepEqual(spans(day.lessons).slice(0, 1), ['08:50–09:35']);
    assert.ok(day.warnings.length);
    assert.deepEqual(day.timeline.map(i => i.kind), ['lesson', 'gap', 'lesson']);
    assertCoveredOnce(day.timeline);
  }
});

test('invalid times, slot order, duplicates, overlaps and ambiguous meals suppress totals', () => {
  const a = lesson('a', [1]);
  const badTimes = ['09:60 - 10:45', '24:00 - 24:45', '09:00 - 09:00', '10:00 - 09:15', 'invalid', '09:00 - 09:44'];
  const invalid = [
    ...badTimes.map(time => [{ ...a, slots: [{ num: 1, time }] }]),
    ...[0, 11, 0.5, '1'].map(num => [{ ...a, slots: [{ num, time: '09:00 - 09:45' }] }]),
    [lesson('a', [1, 3])], [lesson('a', [2, 1])], [lesson('a', [])], [lesson('a', [1, 2, 3])],
    [lesson('Обед', [1, 2])], [a, lesson('b', [1])], [a, lesson('a', [2])],
    [lesson('a', [2]), lesson('b', [1])],
    [a, lesson('b', [2], { slots: [{ num: 2, time: '09:40 - 10:25' }] })],
    [{ ...a, slots: [slot(1), { num: 2, time: '10:00 - 10:45' }] }]
  ];
  for (const rows of invalid) {
    const day = normalize(rows);
    assert.equal(day.status, 'invalid', JSON.stringify(rows));
    assert.ok(day.warnings.length);
    assert.equal(day.summary, null);
    assert.deepEqual(day.timeline, []);
  }
});

test('group filter precedes totals and conflict checks, preserves metadata and only authorized sheet links', () => {
  const one = lesson('a', [1], { groupId: 'g1', teacher: 'Преподаватель А', room: '101/202', type: 'ПР', sheetId: 'sheet' });
  const two = lesson('b', [1], { group: 'ПО-32', groupId: 'g2', sheetId: 'sheet' });
  const rows = [one, two, lesson('Обед', [2], { group: 'ПО-32', groupId: 'g2' })];
  const sheets = [{ sheetId: 'sheet', groupId: 'g1', groupName: 'ПО-31' }];
  const filtered = normalize(rows, { groupFilter: 'g1', sheets });
  assert.equal(filtered.lessons.length, 1);
  for (const field of ['id', 'subject', 'group', 'groupId', 'room', 'type', 'teacher', 'sheetId']) {
    assert.equal(filtered.lessons[0][field], one[field]);
  }
  assert.deepEqual(filtered.summary, { count: 1, hours: 1, end: '09:45' });
  assert.equal(normalize(rows, { groupFilter: 'ПО-32', sheets }).lessons[0].sheetId, null);
  assert.equal(normalize([one]).lessons[0].sheetId, null);
});

test('two demo days, original date labels, no inferred dates and no invented group schedule', () => {
  const today = readSchedule('today', 'ПО-31');
  assert.equal(today.source, 'demo');
  assert.equal(today.dateLabel, 'Пятница, 30 октября');
  assert.equal(today.isoDate, null);
  assert.deepEqual(today.summary, { count: 3, hours: 5, end: '13:25' });
  assert.equal(today.lessons[1].room, '308/309');
  assert.equal(today.lessons[1].sheetId, 'subj-kp-sub2');
  assert.equal(readSchedule('tomorrow').dateLabel, 'Суббота, 31 октября');
  for (const day of ['today', 'tomorrow']) {
    const empty = readSchedule(day, 'ПО-32');
    assert.equal(empty.status, 'empty');
    assert.deepEqual(empty.timeline, []);
  }
  for (const key of ['week', '', undefined]) assert.throws(() => readSchedule(key), RangeError);
});

test('missing, malformed and empty feeds stay distinct; only valid supplied calendar dates survive', () => {
  assert.equal(normalizeScheduleDay('today', null).status, 'unavailable');
  assert.equal(normalizeScheduleDay('today', {}).status, 'invalid');
  assert.equal(normalize([]).status, 'empty');
  assert.equal(normalize([], {}, { isoDate: '2024-02-29' }).isoDate, '2024-02-29');
  const invalidDate = normalize([], {}, { isoDate: '2026-02-29' });
  assert.equal(invalidDate.isoDate, null);
  assert.ok(invalidDate.warnings.length);
});
