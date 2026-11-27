import test from 'node:test';
import assert from 'node:assert/strict';
import { createScopedJournalRepository } from '../src/data/journalRepository.js';
import { BELL_SLOTS, normalizeScheduleDay, readSchedule } from '../src/data/scheduleRepository.js';
import { collegeTime, dayState, lessonCompletion, matchOccurrence, resolveLessonOpening,
  scheduleIntent, scheduleRef, unfinishedLessons } from '../src/data/lessonCompletion.js';

const todayDate = '2026-12-31';
const tomorrowDate = '2027-01-01';
const at = (clock, date = todayDate) => Date.parse(`${date}T${clock}+03:00`);
const journals = [{ id: 'j1', groupId: 'g1', subjectId: 'math' }, { id: 'j2', groupId: 'g2', subjectId: 'math' }];
const sheets = ['main', 'second', 'other'].map((sheetId, i) => {
  const journal = journals[i === 2 ? 1 : 0];
  return { id: 'assignment-' + sheetId, sheetId, journalId: journal.id,
    groupId: journal.groupId, subjectId: journal.subjectId, isMain: i !== 1 };
});
const catalog = { sheets, journals, groups: [{ id: 'g1', name: 'А' }, { id: 'g2', name: 'Б' }],
  curatorGroupIds: ['g1'] };
const main = { sheetId: 'main' };
const second = { sheetId: 'second' };
const names = {
  students: 'vgtk_v2_students', lessons: 'vgtk_v2_lessons', grades: 'vgtk_v2_grades',
  configs: 'vgtk_v2_works_config_by_journal', crossMarks: 'vgtk_v2_works_cross_marks',
  completions: 'vgtk_v2_works_completion_by_journal', overrides: 'vgtk_v2_form6_overrides',
  byDate: 'vgtk_v2_form6_overrides_by_date'
};

function sourceEvent(id, sheet, slots, fields = {}) {
  return { id, subject: 'Математика', sheetId: sheet?.sheetId, groupId: sheet?.groupId, type: 'ЛЕК',
    slots: slots.map(num => {
      const { start, end } = BELL_SLOTS[num - 1];
      return { num, time: start + '–' + end };
    }), ...fields };
}

function sourceDay(day, lessons, complete = true, source = 'live') {
  const isoDate = day === 'today' ? todayDate : tomorrowDate;
  const result = normalizeScheduleDay(day, { isoDate, lessons, complete }, { source, sheets });
  return { ...result, complete };
}

function savedLesson(id, fields = {}) {
  return { id, journalId: 'j1', groupId: 'g1', subjectId: 'math', isoDate: todayDate,
    type: 'ЛЕК', hours: 2, topic: 'Синтетическая тема', homework: '', createdByMain: true, ...fields };
}

function fixture({ lessons = [], grades = [], today, tomorrow } = {}) {
  const students = [{ id: 'a', groupId: 'g1', subgroup: 1 }, { id: 'b', groupId: 'g1', subgroup: 2 },
    { id: 'c', groupId: 'g2', subgroup: 1 }];
  const data = { students, lessons, grades, configs: {}, crossMarks: {}, completions: {}, overrides: {},
    byDate: { entries: {}, bindings: {} } };
  const values = new Map(Object.entries(data).map(([key, value]) => [names[key], JSON.stringify(value)]));
  values.set('vgtk_lessons', '[{"id":"legacy-key","date":"31.12"}]');
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, raw) => values.set(key, raw),
    removeItem: key => values.delete(key) };
  const feed = { today, tomorrow };
  let now = at('14:00:00');
  const eventTarget = new EventTarget();
  const options = { catalog, getStorage: () => storage, getSchedule: day => feed[day], now: () => now, eventTarget };
  return { repo: createScopedJournalRepository(options), options, values, storage, feed, setNow: value => { now = value; } };
}

function snapshot(repo, context = main) {
  const result = repo.read(context);
  assert.ok(result.ok, result.error?.message);
  return result.snapshot;
}

function write(repo, command, context = main) {
  const result = repo.mutate(snapshot(repo, context), command);
  assert.ok(result.ok, result.error?.message);
}

const act = (type, lessonId, fields) => ({ type, lessonId, ...fields });
const confirm = (lessonId, hourIndex, value = true) => act('confirmAttendance', lessonId, { hourIndex, value });
const add = (lessonId, fields = {}, intent) => act('addLesson', lessonId,
  { fields: { isoDate: todayDate, hours: 2, type: 'ЛЕК', ...fields }, scheduleIntent: intent });
const update = (lessonId, fields) => act('updateLesson', lessonId, { fields });
const mark = (lessonId, studentId, hourIndex, value) => act('setGrade', lessonId, { studentId, hourIndex, value });
const absent = { grade: null, attendance: 'ABSENT' };
const numeric = { grade: 8, attendance: 'PRESENT' };
const status = (repo, id, context = main) => lessonCompletion(snapshot(repo, context).lessons.find(l => l.id === id), context.sheetId);
const hours = (repo, id, context) => Object.keys(status(repo, id, context).confirmations).map(Number);

function complete(repo, id, context) {
  const lesson = snapshot(repo, context).lessons.find(l => l.id === id);
  for (let hour = 1; hour <= lesson.hours; hour++) write(repo, confirm(id, hour), context);
  write(repo, act('completeLesson', id), context);
}

test('old shared lessons stay unknown on read, new drafts belong to the creating sheet only', () => {
  const { repo, values } = fixture({ lessons: [savedLesson('shared')] });
  const initial = [...values];
  assert.equal(status(repo, 'shared').status, 'unknown');
  assert.equal(status(repo, 'shared', second).status, 'unknown');
  assert.deepEqual([...values], initial);
  write(repo, add('new', { hours: 1, sheetId: 'other', completionBySheet: { main: { status: 'completed' } } }), second);
  assert.equal(status(repo, 'new').status, 'unknown');
  assert.equal(status(repo, 'new', second).status, 'draft');
  const lesson = snapshot(repo, second).lessons.at(-1);
  assert.deepEqual([lesson.id, lesson.sheetId, lesson.createdByMain, lesson.groupId, lesson.journalId],
    ['new', 'second', false, 'g1', 'j1']);
  assert.deepEqual(Object.keys(lesson.completionBySheet), ['second']);
  assert.equal(values.get('vgtk_lessons'), new Map(initial).get('vgtk_lessons'));
  assert.deepEqual([...values.keys()], initial.map(([key]) => key));
});

test('only explicit completion, with a topic and each hour checked; no synthetic marks', () => {
  const { repo, values, options } = fixture();
  write(repo, add('pair', { topic: '  ', homework: '' }));
  write(repo, confirm('pair', 1));
  assert.equal(repo.mutate(snapshot(repo), act('completeLesson', 'pair')).ok, false);
  write(repo, update('pair', { topic: 'Тема' }));
  assert.equal(repo.mutate(snapshot(repo), act('completeLesson', 'pair')).ok, false);
  write(repo, confirm('pair', 2));
  assert.equal(status(repo, 'pair').status, 'draft');
  write(repo, act('completeLesson', 'pair'));
  const completed = values.get(names.lessons);
  write(repo, act('completeLesson', 'pair'));
  assert.equal(values.get(names.lessons), completed);
  assert.equal(values.get(names.grades), '[]');
  assert.equal(status(createScopedJournalRepository(options), 'pair').status, 'completed');
  write(repo, add('one', { topic: 'Тема', hours: 1 }));
  complete(repo, 'one');
  assert.deepEqual(hours(repo, 'one'), [1]);
});

test('completion is scoped and repeatable; reopening or unchecking affects only the responsible sheet', () => {
  const lesson = savedLesson('lecture', { sheetId: 'main', homework: 'Задание' });
  const storedGrade = { lessonId: lesson.id, studentId: 'a', hourIndex: 1, ...numeric };
  const { repo } = fixture({ lessons: [lesson], grades: [storedGrade] });
  complete(repo, 'lecture', second);
  assert.equal(status(repo, 'lecture').status, 'unknown');
  complete(repo, 'lecture', main);
  write(repo, act('reopenLesson', 'lecture'), second);
  write(repo, act('reopenLesson', 'lecture'), second);
  assert.equal(status(repo, 'lecture', second).status, 'draft');
  assert.equal(status(repo, 'lecture').status, 'completed');
  assert.deepEqual(hours(repo, 'lecture', second), [1, 2]);
  write(repo, act('completeLesson', 'lecture'), second);
  write(repo, confirm('lecture', 2, false), second);
  assert.deepEqual(hours(repo, 'lecture', second), [1]);
  const view = snapshot(repo);
  assert.deepEqual(view.grades, [storedGrade]);
  assert.deepEqual([view.lessons[0].sheetId, view.lessons[0].createdByMain, view.lessons[0].homework],
    ['main', true, 'Задание']);
  for (const context of [{ groupId: 'g1' }, { studentId: 'a' }]) {
    assert.equal(snapshot(repo, context).lessons[0].completionBySheet, undefined);
    for (const command of [confirm('lecture', 1), act('completeLesson', 'lecture'), act('reopenLesson', 'lecture')]) {
      assert.equal(repo.mutate(snapshot(repo, context), command).ok, false);
    }
  }
});

test('wrong scope, unknown target, unknown date, future date and invalid confirmations cannot complete', () => {
  const { repo, values } = fixture({ lessons: [savedLesson('undated', { isoDate: undefined }),
    savedLesson('future', { isoDate: tomorrowDate }), savedLesson('existing')] });
  const initial = [...values];
  for (const command of [confirm('existing', 0), confirm('existing', 3), confirm('existing', '1'),
    confirm('existing', 1, 'true'), act('completeLesson', 'missing')]) {
    assert.equal(repo.mutate(snapshot(repo), command).ok, false);
  }
  assert.equal(repo.mutate(snapshot(repo, { sheetId: 'other' }),
    act('completeLesson', 'existing', { sheetId: 'main' })).ok, false);
  assert.deepEqual([...values], initial);
  for (const id of ['undated', 'future']) {
    write(repo, confirm(id, 1, true));
    write(repo, confirm(id, 2, true));
    assert.equal(repo.mutate(snapshot(repo), act('completeLesson', id)).ok, false);
  }
  write(repo, { ...confirm('existing', 1), sheetId: 'second' });
  assert.equal(status(repo, 'existing', second).status, 'unknown');
});

test('raw Н invalidates only its hour and applicable roster; numeric marks and Form 6 keep checks', () => {
  const practice = savedLesson('practice', { type: 'ПР', isSubgroupOnly: true });
  const { repo } = fixture({ lessons: [practice, savedLesson('lecture')] });
  for (const context of [main, second]) {
    complete(repo, 'practice', context);
    complete(repo, 'lecture', context);
  }
  write(repo, mark('practice', 'a', 1, numeric));
  write(repo, { type: 'setOverride', studentId: 'a', date: todayDate, value: { reason: 'Б', customHours: 2 } },
    { groupId: 'g1' });
  write(repo, update('practice', { topic: 'Новая тема', homework: 'Новое ДЗ' }));
  assert.equal(status(repo, 'practice').status, 'completed');
  write(repo, mark('practice', 'a', 1, absent), second);
  assert.deepEqual(hours(repo, 'practice'), [2]);
  assert.equal(status(repo, 'practice').status, 'draft');
  assert.equal(status(repo, 'practice', second).status, 'completed');
  write(repo, mark('practice', 'a', 1, numeric));
  assert.deepEqual(hours(repo, 'practice'), [2]);
  write(repo, mark('lecture', 'a', 2, absent));
  assert.deepEqual(hours(repo, 'lecture'), [1]);
  assert.deepEqual(hours(repo, 'lecture', second), [1]);
});

test('roster, hours, scope and date changes invalidate; a blank topic reopens without discarding checks', () => {
  const { repo } = fixture({ lessons: [savedLesson('practice', { type: 'ЛАБ' }), savedLesson('lecture')] });
  for (const context of [main, second]) {
    complete(repo, 'practice', context);
    complete(repo, 'lecture', context);
  }
  write(repo, { type: 'setSubgroups', updates: [{ id: 'a', subgroup: 2 }] });
  for (const context of [main, second]) {
    assert.deepEqual(hours(repo, 'practice', context), []);
    assert.equal(status(repo, 'lecture', context).status, 'completed');
  }
  write(repo, update('lecture', { topic: '   ' }));
  assert.equal(status(repo, 'lecture', second).status, 'draft');
  assert.deepEqual(hours(repo, 'lecture', second), [1, 2]);
  write(repo, update('lecture', { topic: 'Тема', hours: 1 }));
  assert.deepEqual(hours(repo, 'lecture'), []);
  assert.equal(repo.mutate(snapshot(repo), confirm('lecture', 2)).ok, false);
  complete(repo, 'lecture');
  write(repo, update('lecture', { isoDate: '2026-12-30' }));
  assert.deepEqual(hours(repo, 'lecture'), []);
  complete(repo, 'lecture');
  write(repo, update('lecture', { type: 'ПР' }));
  assert.deepEqual(hours(repo, 'lecture'), []);
  write(repo, act('deleteLesson', 'lecture'));
  assert.equal(snapshot(repo).lessons.some(l => l.id === 'lecture'), false);
});

test('stale and failed composite writes preserve raw grades, confirmations and legacy keys; subscription is reversible', () => {
  const { repo, options, values, storage } = fixture({ lessons: [savedLesson('lecture')] });
  let changes = 0;
  const stop = repo.subscribe(() => changes++);
  complete(repo, 'lecture');
  const stale = snapshot(repo);
  const other = createScopedJournalRepository(options);
  write(other, confirm('lecture', 1), second);
  const original = new Map(values);
  assert.equal(repo.mutate(stale, act('reopenLesson', 'lecture')).error.code, 'conflict');
  const setItem = storage.setItem;
  storage.setItem = (key, raw) => {
    if (key === names.lessons) throw new Error('Synthetic write failure');
    setItem(key, raw);
  };
  assert.equal(repo.mutate(snapshot(repo), mark('lecture', 'a', 1, absent)).error.code, 'write');
  assert.deepEqual(values, original);
  assert.equal(changes, 4);
  storage.setItem = setItem;
  stop();
  write(repo, mark('lecture', 'a', 1, absent));
  assert.equal(changes, 4);
  assert.deepEqual(hours(repo, 'lecture'), [2]);
  assert.equal(values.get('vgtk_lessons'), original.get('vgtk_lessons'));
});

test('corrupt task metadata is a visible storage error and preserves bytes', () => {
  const bad = savedLesson('bad', { completionBySheet: { main: { status: 'completed', confirmations: { 1: 'broken' } } } });
  const { repo, values } = fixture({ lessons: [bad] });
  const stored = values.get(names.lessons);
  assert.equal(repo.read(main).error.key, 'lessons');
  assert.equal(values.get(names.lessons), stored);
});

test('a subgroup roster with an unresolved assignment cannot be confirmed', () => {
  const { repo, values } = fixture({ lessons: [savedLesson('practice', { type: 'ПР' })] });
  const students = JSON.parse(values.get(names.students));
  delete students[1].subgroup;
  values.set(names.students, JSON.stringify(students));
  assert.equal(repo.mutate(snapshot(repo), confirm('practice', 1)).error.key, 'students');
  assert.equal(status(repo, 'practice').status, 'unknown');
});

test('Minsk clock and exact lesson, internal and external break, window and lunch boundaries', () => {
  const today = sourceDay('today', [sourceEvent('pair', sheets[0], [1, 2]), sourceEvent('single', sheets[0], [3]),
    sourceEvent('late', sheets[0], [5]), sourceEvent('lunch', null, [6], { isLunch: true })]);
  const tomorrow = sourceDay('tomorrow', [sourceEvent('next-year', sheets[0], [1])]);
  assert.deepEqual(collegeTime(new Date('2026-12-31T21:00:00Z')),
    { isoDate: tomorrowDate, tomorrow: '2027-01-02', clock: '00:00:00', seconds: 0 });
  const state = clock => dayState(today, tomorrow, at(clock));
  assert.equal(state('08:59:59').kind, 'before');
  assert.equal(state('08:59:59').countdown, 1);
  assert.equal(state('09:00:00').current.hour, 1);
  assert.equal(state('09:44:59').countdown, 1);
  assert.equal(state('09:45:00').kind, 'internalBreak');
  assert.equal(state('09:45:00').next.hour, 2);
  assert.equal(state('09:55:00').current.hour, 2);
  assert.equal(state('10:40:00').kind, 'break');
  assert.equal(state('10:50:00').current.event.id, 'single');
  assert.equal(state('11:45:00').kind, 'window');
  assert.equal(state('13:35:00').kind, 'lunch');
  assert.equal(state('13:35:00').teachingEnded, true);
  assert.equal(state('13:35:00').next.day, 'tomorrow');
  assert.equal(state('14:20:00').kind, 'after');
});

test('explicit 12:40 lunch, alternate source times and unconfirmed gaps keep actual boundaries', () => {
  const rows = [sourceEvent('early', sheets[0], [1], { slots: [{ num: 1, time: '09:05–09:50' }] }),
    sourceEvent('late', sheets[0], [4], { slots: [{ num: 4, time: '11:40–12:25' }] }),
    sourceEvent('lunch', null, [5], { isLunch: true, slots: [{ num: 5, time: '12:40–13:25' }] })];
  const today = sourceDay('today', rows, false);
  const state = clock => dayState(today, undefined, at(clock));
  assert.equal(state('09:05:00').current.start, '09:05');
  assert.equal(state('10:30:00').kind, 'gap');
  assert.equal(state('10:30:00').countdown, null);
  assert.equal(state('12:39:59').kind, 'gap');
  assert.equal(state('12:40:00').kind, 'lunch');
  assert.equal(state('13:25:00').kind, 'lastKnown');
});

test('demo, unknown, invalid, unavailable, incomplete, stale and confirmed empty stay distinct', () => {
  const now = at('09:30:00');
  const demo = dayState(readSchedule('today'), readSchedule('tomorrow'), now);
  assert.equal(demo.kind, 'demo');
  assert.equal(demo.countdown, undefined);
  assert.equal(demo.next, null);
  const empty = sourceDay('today', []);
  assert.equal(dayState(empty, undefined, now).kind, 'empty');
  assert.equal(dayState({ ...empty, complete: false }, undefined, now).kind, 'gap');
  const good = sourceDay('today', [sourceEvent('lesson', sheets[0], [1])]);
  const invalidTimeline = [...good.timeline, { kind: 'break', start: '09:30', end: '09:46' }];
  for (const value of [undefined, { ...good, status: 'unavailable' }, { ...good, status: 'invalid' },
    { ...good, isoDate: null }, { ...good, isoDate: '2026-12-30' },
    { ...good, source: 'unknown' }, { ...good, timeline: invalidTimeline }]) {
    assert.equal(dayState(value, undefined, now).kind, 'unavailable');
  }
});

test('equal subjects on the same date separate by assigned journal and exact slots, not event/lesson ID', () => {
  const today = sourceDay('today', [sourceEvent('sch-first', sheets[0], [1]), sourceEvent('sch-second', sheets[0], [2]),
    sourceEvent('sch-other', sheets[2], [3])]);
  const [first, secondSlot, other] = today.lessons.map(event => scheduleRef(today, event, sheets));
  const saved = savedLesson('sch-second', { hours: 1, scheduleRefsBySheet: { main: first } });
  assert.deepEqual(matchOccurrence(first, [saved]), { kind: 'linked', lessonId: 'sch-second' });
  assert.equal(matchOccurrence(secondSlot, [saved]).kind, 'missing');
  assert.equal(matchOccurrence(other, [saved]).kind, 'missing');
  assert.equal(matchOccurrence(secondSlot, [savedLesson('sch-second', { hours: 1 })]).kind, 'ambiguous');
  assert.equal(matchOccurrence(first, [saved, { ...saved, id: 'duplicate' }]).kind, 'ambiguous');
  assert.equal(matchOccurrence({ ...first, slots: secondSlot.slots }, [saved]).kind, 'ambiguous');
});

test('validated opening is read-only; add from an exact schedule occurrence is explicit and cannot duplicate', () => {
  const today = sourceDay('today', [sourceEvent('sch-1', sheets[0], [1, 2])]);
  const { repo, values, feed, setNow } = fixture({ today });
  setNow(at('09:55:00'));
  const ref = scheduleRef(today, today.lessons[0], sheets);
  const intent = scheduleIntent('today', ref);
  const base = snapshot(repo);
  const options = { today, sheets, now: at('09:55:00'), snapshot: base };
  const before = values.get(names.lessons);
  for (let i = 0; i < 2; i++) {
    assert.equal(resolveLessonOpening({ kind: 'schedule', schedule: intent }, options).kind, 'missing');
    assert.equal(resolveLessonOpening({ kind: 'schedule', schedule: { ...intent, key: 'sch-1' } }, options), null);
    assert.equal(resolveLessonOpening({ kind: 'lesson', lessonId: 'sch-1' }, options), null);
    assert.equal(resolveLessonOpening({ kind: 'schedule', schedule: intent }, { ...options, snapshot: snapshot(repo, second) }), null);
  }
  assert.equal(values.get(names.lessons), before);
  assert.equal(repo.mutate(base, add('wrong-hours', { hours: 1 }, intent)).ok, false);
  feed.today = { ...today, source: 'demo' };
  assert.equal(repo.mutate(base, add('bad-source', {}, intent)).ok, false);
  feed.today = today;
  write(repo, add('explicit', { topic: 'Тема' }, intent));
  assert.equal(repo.mutate(base, add('stale-copy', {}, intent)).error.code, 'conflict');
  assert.equal(repo.mutate(snapshot(repo), add('other-copy', {}, intent)).ok, false);
  assert.deepEqual(snapshot(repo).lessons.map(l => l.id), ['explicit']);
  write(repo, confirm('explicit', 1));
  write(repo, confirm('explicit', 2));
  assert.equal(repo.mutate(snapshot(repo), act('completeLesson', 'explicit')).ok, false);
  setNow(at('10:40:00'));
  write(repo, act('completeLesson', 'explicit'));
  assert.equal(resolveLessonOpening({ kind: 'schedule', schedule: intent }, { ...options, snapshot: snapshot(repo) }).lessonId, 'explicit');
});

test('explicit manual binding checks date/hours, keeps a shared lesson and drops incompatible refs on edits', () => {
  const shared = savedLesson('shared');
  const undated = savedLesson('undated', { isoDate: undefined });
  const differentHours = savedLesson('one', { hours: 1 });
  const today = sourceDay('today', [sourceEvent('sch-1', sheets[0], [1, 2])]);
  const { repo, feed } = fixture({ lessons: [shared, undated, differentHours], today });
  const intent = scheduleIntent('today', scheduleRef(today, today.lessons[0], sheets));
  const bind = (id, request = intent) => act('bindSchedule', id, { scheduleIntent: request });
  assert.equal(repo.mutate(snapshot(repo), add('premature', {}, intent)).ok, false);
  for (const id of ['undated', 'one']) assert.equal(repo.mutate(snapshot(repo), bind(id)).ok, false);
  write(repo, bind('shared'));
  write(repo, bind('shared'));
  const otherSchedule = sourceDay('today', [sourceEvent('same-time-sub2', sheets[1], [1, 2])]);
  const otherIntent = scheduleIntent('today', scheduleRef(otherSchedule, otherSchedule.lessons[0], sheets));
  feed.today = otherSchedule;
  assert.equal(repo.mutate(snapshot(repo, second), add('duplicate-shared', {}, otherIntent)).ok, false);
  write(repo, bind('shared', otherIntent), second);
  const lesson = snapshot(repo).lessons[0];
  assert.deepEqual(Object.keys(lesson.scheduleRefsBySheet), ['main', 'second']);
  assert.equal(lesson.createdByMain, true);
  assert.equal(snapshot(repo).lessons.length, 3);
  write(repo, update('shared', { type: 'ПР' }));
  assert.equal(snapshot(repo).lessons[0].scheduleRefsBySheet, undefined);
});

test('unfinished rows separate per sheet, with no debt at unknown or future times, or on demo', () => {
  const today = sourceDay('today', [sourceEvent('draft', sheets[0], [1, 2]), sourceEvent('completed', sheets[0], [3]),
    sourceEvent('unknown', sheets[0], [4]), sourceEvent('missing', sheets[2], [5]),
    sourceEvent('unassigned', null, [6]), sourceEvent('future', sheets[0], [7])]);
  const [draft, completed, unknown, , , future] = today.lessons.map(event => scheduleRef(today, event, sheets));
  const { repo } = fixture({ lessons: [
    savedLesson('draft', { scheduleRefsBySheet: { main: draft } }),
    savedLesson('completed', { hours: 1, scheduleRefsBySheet: { main: completed } }),
    savedLesson('unknown', { hours: 1, scheduleRefsBySheet: { main: unknown } }),
    savedLesson('future', { hours: 1, scheduleRefsBySheet: { main: future } }),
    savedLesson('today'), savedLesson('undated', { isoDate: undefined }), savedLesson('tomorrow', { isoDate: tomorrowDate })
  ] });
  for (const id of ['draft', 'undated', 'future', 'today', 'tomorrow']) write(repo, confirm(id, 1));
  write(repo, confirm('draft', 1), second);
  complete(repo, 'completed');
  const available = [snapshot(repo), snapshot(repo, second), snapshot(repo, { sheetId: 'other' })];
  const result = unfinishedLessons(available, today, at('14:20:00'), sheets);
  assert.deepEqual(result.scheduled.map(item => [item.event.id, item.kind]), [['missing', 'missing']]);
  assert.equal(result.uncertain, true);
  assert.deepEqual(result.saved.filter(item => item.status === 'draft').map(({ lesson, sheet, timing }) => [lesson.id, sheet.sheetId, timing]),
    [['draft', 'main', 'past'], ['today', 'main', 'unknownTime'], ['undated', 'main', 'undated'], ['draft', 'second', 'past']]);
  assert.ok(result.saved.some(item => item.lesson.id === 'unknown' && item.status === 'unknown'));
  assert.ok(!result.saved.some(item => ['future', 'tomorrow'].includes(item.lesson.id)));
  assert.deepEqual(unfinishedLessons(available, { ...today, source: 'demo' }, at('14:20:00'), sheets).scheduled, []);
  assert.equal(unfinishedLessons(available.slice(0, 2), today, at('14:20:00'), sheets).uncertain, true);
});

test('ended occurrence with a possible undated lesson requires matching, not a debt', () => {
  const today = sourceDay('today', [sourceEvent('sch-1', sheets[0], [1, 2])], false);
  const { repo } = fixture({ lessons: [savedLesson('undated', { isoDate: undefined })] });
  const view = snapshot(repo);
  assert.deepEqual(unfinishedLessons([view], today, at('10:39:59'), sheets).scheduled, []);
  assert.equal(unfinishedLessons([view], today, at('10:40:00'), sheets).scheduled[0].kind, 'ambiguous');
});
