import { currentUser, mockSchedule } from '../mocks/initialData.js';

const LESSON_MINUTES = 45;
const BREAK_MINUTES = 10;

function clock(minutes) {
  return [Math.floor(minutes / 60), minutes % 60].map(n => String(n).padStart(2, '0')).join(':');
}

export const BELL_SLOTS = Object.freeze(Array.from({ length: 10 }, (_, i) => {
  const start = 9 * 60 + i * (LESSON_MINUTES + BREAK_MINUTES);
  return Object.freeze({ num: i + 1, start: clock(start), end: clock(start + LESSON_MINUTES) });
}));

function minutes(time) {
  const [hours, mins] = time.split(':').map(Number);
  return hours * 60 + mins;
}

function parseSlot(slot) {
  const match = typeof slot?.time === 'string' &&
    slot.time.trim().match(/^([01]\d|2[0-3])[.:]([0-5]\d)\s*[-–—]\s*([01]\d|2[0-3])[.:]([0-5]\d)$/u);
  if (!match || !Number.isInteger(slot.num) || slot.num < 1 || slot.num > BELL_SLOTS.length) return null;
  const start = match[1] + ':' + match[2];
  const end = match[3] + ':' + match[4];
  return minutes(end) - minutes(start) === LESSON_MINUTES ? { num: slot.num, start, end } : null;
}

const breakBetween = (left, right) => ({ kind: 'break', start: left.end, end: right.start });

function withBreaks(slots) {
  return slots.flatMap((slot, i) => [
    ...(i ? [breakBetween(slots[i - 1], slot)] : []),
    { kind: 'slot', ...slot }
  ]);
}

function normalizeLesson(row, sheets, warnings) {
  if (typeof row?.id !== 'string' || !row.id.trim()) throw new RangeError('У записи отсутствует идентификатор.');
  const fail = message => { throw new RangeError(row.id + ': ' + message); };
  const isLunch = row.isLunch === true || (typeof row.subject === 'string' && row.subject.trim().toLowerCase() === 'обед');
  if (!Array.isArray(row.slots) || !row.slots.length || row.slots.length > (isLunch ? 1 : 2)) {
    fail(isLunch ? 'обед должен занимать один слот.' : 'ожидался один урок или пара.');
  }
  const slots = row.slots.map(parseSlot);
  if (slots.some(s => !s)) fail('некорректный номер урока или интервал в 45 минут.');
  const [first, second] = slots;
  if (second && (second.num !== first.num + 1 || minutes(second.start) - minutes(first.end) !== BREAK_MINUTES)) {
    fail('слоты пары должны идти подряд с десятиминутной переменой.');
  }
  if (!isLunch && (typeof row.subject !== 'string' || !row.subject.trim())) fail('отсутствует название занятия.');
  for (const key of ['subject', 'group', 'groupId', 'teacher', 'type', 'room']) {
    if (row[key] != null && typeof row[key] !== 'string') fail('некорректное поле ' + key + '.');
  }
  if (row.hoursCount != null && row.hoursCount !== slots.length) {
    warnings.push(row.id + ': количество часов в источнике расходится со слотами. Итоги рассчитаны по слотам.');
  }
  const sheet = !isLunch && sheets.find(s => s.sheetId === row.sheetId &&
    (!row.groupId || s.groupId === row.groupId) && (!row.group || s.groupName === row.group));
  if (row.sheetId && !sheet) warnings.push(row.id + ': лист журнала для этой записи не подтверждён.');
  return { id: row.id, kind: isLunch ? 'lunch' : 'lesson', isLunch, subject: row.subject || 'Обед',
    group: row.group, groupId: row.groupId, teacher: row.teacher, type: row.type, room: row.room,
    sheetId: sheet?.sheetId ?? null, slots, start: first.start, end: slots.at(-1).end,
    hours: isLunch ? 0 : slots.length, parts: withBreaks(slots) };
}

function intervalBetween(left, right, inferWindows) {
  const a = left.slots.at(-1);
  const b = right.slots[0];
  const gap = { kind: 'gap', start: a.end, end: b.start };
  if (a.end === b.start) return [];
  if (b.num === a.num + 1) {
    return [minutes(b.start) - minutes(a.end) === BREAK_MINUTES ? breakBetween(a, b) : gap];
  }
  if (!inferWindows) return [gap];
  const free = BELL_SLOTS.slice(a.num, b.num - 1);
  return [breakBetween(a, free[0]), { kind: 'window', start: free[0].start, end: free.at(-1).end,
    slots: free, parts: withBreaks(free) }, breakBetween(free.at(-1), b)];
}

function confirmedDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return null;
  const timestamp = Date.parse(value + 'T00:00:00Z');
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value ? value : null;
}

export function normalizeScheduleDay(day, record, { groupFilter = null, source = 'unknown', sheets = [] } = {}) {
  if (day !== 'today' && day !== 'tomorrow') throw new RangeError('Допустимые дни расписания: today и tomorrow.');
  const warnings = [];
  const result = { day, source, status: 'unavailable', dateLabel: typeof record?.dateLabel === 'string' ? record.dateLabel : '',
    isoDate: confirmedDate(record?.isoDate), lessons: [], timeline: [], summary: null, warnings };
  if (record == null) return result;
  if (record.isoDate != null && !result.isoDate) warnings.push('Календарная дата источника не подтверждена.');
  try {
    if (!Array.isArray(record.lessons)) throw new RangeError('Источник не содержит списка занятий.');
    const rows = record.lessons.filter(row => {
      if (!row || typeof row !== 'object') throw new RangeError('В расписании обнаружена некорректная запись.');
      return groupFilter == null || row.group === groupFilter || row.groupId === groupFilter;
    });
    const lessons = rows.map(row => normalizeLesson(row, sheets, warnings));
    const ids = new Set();
    let onGrid = true;
    for (const [i, lesson] of lessons.entries()) {
      const prev = lessons[i - 1];
      if (ids.has(lesson.id) || (prev && (prev.end > lesson.start || prev.slots.at(-1).num >= lesson.slots[0].num))) {
        throw new RangeError('Повтор, перекрытие или нарушение порядка записей: ' + lesson.id + '.');
      }
      ids.add(lesson.id);
      if (lesson.slots.some(s => BELL_SLOTS[s.num - 1].start !== s.start)) onGrid = false;
    }
    if (!onGrid) warnings.push('Время отличается от сетки звонков. Показаны интервалы источника, свободные слоты не подтверждены.');
    const inferWindows = onGrid && (record.complete === true || (source === 'demo' && record.complete !== false));
    const timeline = lessons.flatMap((lesson, i) => [
      ...(i ? intervalBetween(lessons[i - 1], lesson, inferWindows) : []), lesson
    ]);
    const teaching = lessons.filter(lesson => !lesson.isLunch);
    return { ...result, status: lessons.length ? 'ready' : 'empty', lessons, timeline,
      summary: { count: teaching.length, hours: teaching.reduce((sum, l) => sum + l.hours, 0),
        end: teaching.at(-1)?.end ?? null } };
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    warnings.push(error.message);
    return { ...result, status: 'invalid' };
  }
}

export function readSchedule(day, groupFilter = null) {
  return normalizeScheduleDay(day, mockSchedule[day], { groupFilter, source: 'demo', sheets: currentUser.teachingSubjects });
}
