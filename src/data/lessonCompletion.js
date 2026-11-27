import { isCalendarDate, lessonDate, monthLength } from './period.js';

const minskClock = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Minsk', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
});
const pad = number => String(number).padStart(2, '0');
const supportedTypes = ['ЛЕК', 'ПР', 'ЛАБ', 'УРОК', 'КР', 'ОК'];
const isId = value => typeof value === 'string' && value.trim().length > 0;
export const ownEntry = (record, key) => Object.hasOwn(record ?? {}, key) ? record[key] : undefined;
export const isSubgroupLesson = lesson => lesson.type === 'ПР' || lesson.type === 'ЛАБ' || Boolean(lesson.isSubgroupOnly);
export const hasTopic = lesson => typeof lesson.topic === 'string' && lesson.topic.trim().length > 0;
export const completionLabel = { unknown: 'Статус не определён', draft: 'Черновик', completed: 'Завершено' };

export function collegeTime(now) {
  if (!(now instanceof Date) && typeof now !== 'number') return null;
  const timestamp = Number(now);
  if (!Number.isFinite(timestamp) || Math.abs(timestamp) > 8.64e15) return null;
  const { year, month, day, hour, minute, second } = Object.fromEntries(
    minskClock.formatToParts(timestamp).map(({ type, value }) => [type, value])
  );
  const isoDate = year.padStart(4, '0') + '-' + month + '-' + day;
  if (!isCalendarDate(isoDate)) return null;
  const next = Number(day) + 1;
  const rollover = next > monthLength(isoDate.slice(0, 7));
  const nextMonth = Number(month) === 12 ? '01' : pad(Number(month) + 1);
  const tomorrow = rollover
    ? (Number(month) === 12 ? String(Number(year) + 1).padStart(4, '0') : year.padStart(4, '0')) + '-' + nextMonth + '-01'
    : isoDate.slice(0, 8) + pad(next);
  return { isoDate, tomorrow, clock: hour + ':' + minute + ':' + second,
    seconds: Number(hour) * 3600 + Number(minute) * 60 + Number(second) };
}

const secondsAt = time => {
  if (typeof time !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) return NaN;
  return Number(time.slice(0, 2)) * 3600 + Number(time.slice(3)) * 60;
};
const validInterval = item => secondsAt(item?.start) < secondsAt(item?.end);
const validSlots = slots => Array.isArray(slots) && [1, 2].includes(slots.length) &&
  slots.every((slot, i) => validInterval(slot) && Number.isInteger(slot.num) && slot.num > 0 &&
    (!i || (slots[i - 1].end < slot.start && slots[i - 1].num + 1 === slot.num)));
const slotKey = slots => JSON.stringify(slots.map(({ num, start, end }) => [num, start, end]));

function eventKey(event) {
  return JSON.stringify([event.kind, event.id ?? null, event.sheetId ?? null, event.groupId ?? null,
    event.group ?? null, event.journalId ?? null, event.subjectId ?? null, event.type ?? null, event.hours, slotKey(event.slots)]);
}

function validEvent(event) {
  return ['lesson', 'lunch'].includes(event?.kind) && validSlots(event.slots) &&
    (event.id == null || isId(event.id)) && event.start === event.slots[0].start && event.end === event.slots.at(-1).end &&
    (event.kind === 'lesson'
      ? event.hours === event.slots.length && event.isLunch !== true
      : event.hours === 0 && event.slots.length === 1);
}

export function confirmedDay(schedule, day, time) {
  if (!time || !['today', 'tomorrow'].includes(day) || schedule?.source !== 'live' || schedule.day !== day ||
    schedule.isoDate !== (day === 'today' ? time.isoDate : time.tomorrow) || !isCalendarDate(schedule.isoDate) ||
    !Array.isArray(schedule.lessons) || !Array.isArray(schedule.timeline)) return null;
  if (schedule.status === 'empty') {
    return !schedule.lessons.length && !schedule.timeline.length ? schedule : null;
  }
  if (schedule.status !== 'ready' || !schedule.lessons.length || !schedule.lessons.every(validEvent)) return null;
  const ids = schedule.lessons.filter(event => event.id != null)
    .map(event => JSON.stringify([event.sheetId ?? null, event.groupId ?? null, event.id]));
  if (new Set(ids).size !== ids.length) return null;
  let cursor = 0;
  for (const [i, item] of schedule.timeline.entries()) {
    if (!validInterval(item) || (i && schedule.timeline[i - 1].end > item.start)) return null;
    if (['lesson', 'lunch'].includes(item.kind)) {
      const event = schedule.lessons[cursor++];
      if (!event || !validEvent(item) || eventKey(item) !== eventKey(event)) return null;
    } else if (!['break', 'window', 'gap'].includes(item.kind)) return null;
  }
  return cursor === schedule.lessons.length ? schedule : null;
}

export function scheduleRef(schedule, event, sheets) {
  if (schedule?.source !== 'live' || schedule.status !== 'ready' || !isCalendarDate(schedule.isoDate) ||
    !validEvent(event) || event.kind !== 'lesson') return null;
  const matches = sheets.filter(sheet => sheet.sheetId === event.sheetId);
  if (matches.length !== 1) return null;
  const [{ id, sheetId, journalId, groupId, subjectId, groupName }] = matches;
  if ((event.groupId != null && event.groupId !== groupId) || (event.group != null && groupName && event.group !== groupName) ||
    (event.journalId != null && event.journalId !== journalId) || (event.subjectId != null && event.subjectId !== subjectId)) return null;
  const reference = { assignmentId: id, sheetId, journalId, groupId, subjectId, isoDate: schedule.isoDate,
    sourceId: event.id ?? null, type: supportedTypes.includes(event.type) ? event.type : null,
    slots: event.slots.map(({ num, start, end }) => ({ num, start, end })) };
  return validScheduleRef(reference, matches[0]) ? reference : null;
}

export function validScheduleRef(ref, sheet) {
  return ref != null && sheet != null && isId(ref.assignmentId) && ref.assignmentId === sheet.id &&
    [ref.sheetId, ref.journalId, ref.groupId, ref.subjectId].every(isId) &&
    ref.sheetId === sheet.sheetId && ref.journalId === sheet.journalId && ref.groupId === sheet.groupId &&
    ref.subjectId === sheet.subjectId && isCalendarDate(ref.isoDate) &&
    (ref.sourceId === null || isId(ref.sourceId)) && (ref.type === null || supportedTypes.includes(ref.type)) && validSlots(ref.slots);
}

export function fitsScheduleRef(lesson, ref) {
  return lesson.journalId === ref.journalId && lesson.groupId === ref.groupId && lesson.subjectId === ref.subjectId &&
    lessonDate(lesson) === ref.isoDate && lesson.hours === ref.slots.length &&
    (ref.type === null || (lesson.type === ref.type && isSubgroupLesson(lesson) === isSubgroupLesson(ref)));
}

export const occurrenceKey = ref => JSON.stringify([ref.assignmentId, ref.sheetId, ref.journalId, ref.groupId,
  ref.subjectId, ref.isoDate, ref.sourceId, ref.type, slotKey(ref.slots)]);
const sameSlots = (left, right) => slotKey(left.slots) === slotKey(right.slots);
const overlaps = (left, right) => left.slots[0].start < right.slots.at(-1).end &&
  right.slots[0].start < left.slots.at(-1).end;

export function matchOccurrence(ref, lessons) {
  const exact = [];
  const candidates = [];
  const bindable = [];
  const conflicting = [];
  for (const lesson of lessons) {
    if (lesson.journalId !== ref.journalId || lesson.groupId !== ref.groupId || lesson.subjectId !== ref.subjectId) continue;
    const date = lessonDate(lesson);
    if (date && date !== ref.isoDate) continue;
    const own = ownEntry(lesson.scheduleRefsBySheet, ref.sheetId);
    if (own && occurrenceKey(own) === occurrenceKey(ref) && fitsScheduleRef(lesson, ref)) {
      exact.push(lesson);
      continue;
    }
    const refs = Object.values(lesson.scheduleRefsBySheet ?? {});
    const collision = refs.some(other => overlaps(other, ref) ||
      (other.sheetId === ref.sheetId && other.sourceId !== null && other.sourceId === ref.sourceId));
    if (refs.length && !collision && refs.every(other => fitsScheduleRef(lesson, other))) continue;
    candidates.push(lesson);
    if (collision) conflicting.push(lesson);
    if (!own && fitsScheduleRef(lesson, ref) && refs.every(other => sameSlots(other, ref))) bindable.push(lesson);
  }
  // Непривязанное занятие не отменяет уже доказанную связь. Конфликт двух привязок — отменяет.
  if (exact.length === 1 && !conflicting.length) return { kind: 'linked', lessonId: exact[0].id };
  if (exact.length || candidates.length) return { kind: 'ambiguous', candidates: [...exact, ...candidates],
    bindable: exact.length ? [] : bindable.filter(lesson => conflicting.every(other => other === lesson)) };
  return { kind: 'missing' };
}

export function scheduleIntent(day, ref) {
  return { day, key: occurrenceKey(ref) };
}

export function resolveScheduleIntent(intent, { today, tomorrow, now, sheets, snapshot }) {
  if (!snapshot?.sheet || typeof intent?.key !== 'string' || !['today', 'tomorrow'].includes(intent.day)) return null;
  const schedule = confirmedDay(intent.day === 'today' ? today : tomorrow, intent.day, collegeTime(now));
  const matches = (schedule?.lessons ?? []).map(event => scheduleRef(schedule, event, sheets))
    .filter(ref => ref?.sheetId === snapshot.sheet.sheetId && validScheduleRef(ref, snapshot.sheet) && occurrenceKey(ref) === intent.key);
  if (matches.length !== 1) return null;
  const [ref] = matches;
  return { ref, ...matchOccurrence(ref, snapshot.lessons) };
}

export function resolveLessonOpening(intent, options) {
  if (intent?.kind === 'lesson' && options.snapshot?.lessons.some(lesson => lesson.id === intent.lessonId)) {
    return { kind: 'linked', lessonId: intent.lessonId };
  }
  if (intent?.kind !== 'schedule') return null;
  const result = resolveScheduleIntent(intent.schedule, options);
  return result && { ...result, intent: intent.schedule };
}

export function lessonScopeSignature(lesson) {
  return JSON.stringify([lesson.journalId, lesson.groupId, lesson.subjectId, lessonDate(lesson),
    lesson.hours, lesson.type ?? null, isSubgroupLesson(lesson)]);
}

export function attendanceSignatures(lesson, sheet, students, grades) {
  const subgroup = isSubgroupLesson(lesson) ? (sheet.isMain ? 1 : 2) : null;
  const group = students.filter(s => s.groupId === lesson.groupId);
  if (subgroup !== null && group.some(s => ![1, 2].includes(Number(s.subgroup)))) return {};
  const roster = group.filter(s => subgroup === null || Number(s.subgroup) === subgroup)
    .map(s => s.id).sort();
  const scope = lessonScopeSignature(lesson);
  const rosterIds = new Set(roster);
  const absent = [[], []];
  for (const grade of grades) {
    if (grade.lessonId === lesson.id && grade.attendance === 'ABSENT' && rosterIds.has(grade.studentId)) {
      absent[(grade.hourIndex ?? 1) - 1].push(grade.studentId);
    }
  }
  return Object.fromEntries(Array.from({ length: lesson.hours }, (_, i) =>
    [i + 1, JSON.stringify([sheet.id, subgroup, scope, roster, absent[i].sort()])]));
}

export function currentCompletion(lesson, entry, signatures) {
  if (!entry) return null;
  const confirmations = Object.fromEntries(Object.entries(entry.confirmations)
    .filter(([hour, signature]) => signatures[hour] === signature));
  const status = entry.status === 'completed' && hasTopic(lesson) && lessonDate(lesson) &&
    Object.keys(confirmations).length === lesson.hours ? 'completed' : 'draft';
  return { status, confirmations };
}

export function lessonCompletion(lesson, sheetId) {
  return ownEntry(lesson.completionBySheet, sheetId) ?? { status: 'unknown', confirmations: {} };
}

function teachingSegments(schedule) {
  return schedule.timeline.flatMap(item => {
    if (item.kind !== 'lesson') return [item];
    return item.slots.flatMap((slot, i) => [
      ...(i ? [{ kind: 'internalBreak', start: item.slots[i - 1].end, end: slot.start, event: item }] : []),
      { ...slot, kind: 'lesson', hour: i + 1, event: item }
    ]);
  });
}

export function dayState(today, tomorrow, now) {
  const time = collegeTime(now);
  const schedule = confirmedDay(today, 'today', time);
  if (!schedule) return { kind: today?.source === 'demo' ? 'demo' : 'unavailable', time, next: null };
  const segments = teachingSegments(schedule);
  const remaining = item => secondsAt(item.start) - time.seconds;
  const current = segments.find(item => remaining(item) <= 0 && time.seconds < secondsAt(item.end));
  const lessons = segments.filter(item => item.kind === 'lesson');
  const nextToday = lessons.find(item => remaining(item) > 0);
  const last = lessons.at(-1);
  const teachingEnded = Boolean(last && time.seconds >= secondsAt(last.end));
  const nextDay = confirmedDay(tomorrow, 'tomorrow', time);
  const nextTomorrow = nextDay && teachingSegments(nextDay).find(item => item.kind === 'lesson');
  const next = nextToday ? { ...nextToday, day: 'today' } : nextTomorrow ? { ...nextTomorrow, day: 'tomorrow' } : null;
  const noLessons = !lessons.length && schedule.complete === true;
  const nextSegment = segments.find(item => remaining(item) > 0);
  const beforeFirst = nextToday && nextToday === lessons[0] && nextSegment === segments[0];
  const kind = current?.kind ?? (noLessons ? 'empty' : teachingEnded
    ? (schedule.complete === true ? 'after' : 'lastKnown')
    : beforeFirst ? 'before' : 'gap');
  return { kind, time, current, next, teachingEnded, complete: schedule.complete === true,
    nextChange: current ? secondsAt(current.end) - time.seconds : nextSegment && remaining(nextSegment),
    countdown: current && current.kind !== 'gap' ? secondsAt(current.end) - time.seconds
      : kind === 'before' && nextSegment === nextToday && schedule.complete === true ? remaining(nextToday) : null };
}

export function lessonTiming(lesson, time) {
  const date = lessonDate(lesson);
  if (!date || !time) return 'undated';
  if (date > time.isoDate) return 'future';
  if (date < time.isoDate) return 'past';
  const refs = Object.values(lesson.scheduleRefsBySheet ?? {}).filter(ref => fitsScheduleRef(lesson, ref));
  if (!refs.length) return 'unknownTime';
  return refs.some(ref => time.seconds < secondsAt(ref.slots.at(-1).end)) ? 'future' : 'past';
}

export function unfinishedLessons(snapshots, today, now, sheets) {
  const time = collegeTime(now);
  const schedule = confirmedDay(today, 'today', time);
  const saved = new Map();
  const bySheet = new Map(snapshots.map(snapshot => [snapshot.sheet.sheetId, snapshot]));
  for (const { sheet, lessons } of bySheet.values()) {
    for (const lesson of lessons) {
      const status = lessonCompletion(lesson, sheet.sheetId).status;
      const timing = lessonTiming(lesson, time);
      if (status !== 'completed' && timing !== 'future') {
        saved.set(JSON.stringify([lesson.id, sheet.sheetId]), { sheet, lesson, status, timing });
      }
    }
  }
  const scheduled = new Map();
  let uncertain = false;
  for (const event of schedule?.lessons ?? []) {
    if (event.kind !== 'lesson' || time.seconds < secondsAt(event.end)) continue;
    const ref = scheduleRef(schedule, event, sheets);
    const snapshot = ref && bySheet.get(ref.sheetId);
    if (!snapshot) {
      uncertain = true;
      continue;
    }
    const match = matchOccurrence(ref, snapshot.lessons);
    if (match.kind !== 'linked') scheduled.set(occurrenceKey(ref), { event, ref, kind: match.kind });
  }
  return { saved: [...saved.values()], scheduled: [...scheduled.values()], uncertain };
}
