import { containsDate, lessonDate, monthDates } from './period.js';

export const reasons = ['Б', 'О', 'З', 'К', 'Н/У', 'Сп'];

export function validOverride(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    (value.cleared === true || reasons.includes(value.reason)) &&
    (value.reason === undefined || reasons.includes(value.reason)) &&
    (value.cleared === undefined || typeof value.cleared === 'boolean') &&
    (value.customHours == null || (Number.isSafeInteger(value.customHours) && value.customHours >= 0));
}

function totals() {
  return { 'Б': 0, 'О': 0, 'З': 0, 'К': 0, 'Н/У': 0, grandTotal: 0, excusedTotal: 0, freeDays: 0 };
}

function count(total, entry) {
  if (entry.reason === 'Сп') {
    total.freeDays++;
    return;
  }
  total[entry.reason] += entry.hours;
  total.grandTotal += entry.hours;
  if (entry.reason !== 'Н/У') total.excusedTotal += entry.hours;
}

// На входе снимок репозитория. Календарь и итоги используют одни и те же ячейки.
export function aggregateAttendance(snapshot, period) {
  const { group, students, lessons, grades, overrides } = snapshot;
  const byStudent = new Map(students.filter(s => s.groupId === group.id).map(s => [s.id, totals()]));
  const included = new Map();
  const dates = new Set();
  for (const lesson of lessons) {
    const date = lessonDate(lesson);
    if (lesson.groupId === group.id && containsDate(period, date)) {
      included.set(lesson.id, { lesson, date });
      dates.add(date);
    }
  }
  const journalHours = new Map();
  const cells = new Map();
  function cell(studentId, date) {
    const key = studentId + '_' + date;
    if (!cells.has(key)) cells.set(key, { studentId, date, journalHours: 0 });
    return cells.get(key);
  }
  for (const grade of grades) {
    const link = included.get(grade.lessonId);
    const hour = grade.hourIndex === undefined ? 1 : grade.hourIndex;
    if (link && byStudent.has(grade.studentId) && grade.attendance === 'ABSENT' &&
      Number.isInteger(hour) && hour >= 1 && hour <= link.lesson.hours) {
      cell(grade.studentId, link.date).journalHours++;
      const id = link.lesson.journalId;
      journalHours.set(id, (journalHours.get(id) ?? 0) + 1);
    }
  }
  for (const [key, override] of Object.entries(overrides)) {
    const cut = key.lastIndexOf('_');
    const studentId = key.slice(0, cut);
    const date = key.slice(cut + 1);
    if (!byStudent.has(studentId) || !containsDate(period, date)) continue;
    dates.add(date);
    cell(studentId, date).override = override;
  }
  const groupTotals = totals();
  for (const item of cells.values()) {
    const { journalHours, override } = item;
    const reason = override?.reason ?? 'Н/У';
    const hours = reason === 'Сп' ? 0 : override?.customHours ?? journalHours;
    if (override?.cleared || (hours === 0 && reason !== 'Сп')) continue;
    item.entry = { reason, hours, journalHours, isManualHours: override?.customHours != null && reason !== 'Сп' };
    count(byStudent.get(item.studentId), item.entry);
    count(groupTotals, item.entry);
  }
  return {
    dates: period.mode === 'month' ? monthDates(period.month) : [...dates].sort(),
    getEntry: (studentId, date) => cells.get(studentId + '_' + date)?.entry ?? null,
    byStudent, groupTotals, journalHours
  };
}
