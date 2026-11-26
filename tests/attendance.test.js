import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateAttendance, reasons } from '../src/data/attendance.js';
import { containsDate, dateFields, isCalendarDate, monthDates, validPeriod } from '../src/data/period.js';
import { getLessonTimestamp } from '../src/components/journal/lessonDate.js';

test('strict Gregorian dates, month boundaries and inclusive date ranges', () => {
  for (const [month, length] of [['2024-02', 29], ['2026-02', 28], ['1900-02', 28],
    ['2000-02', 29], ['2026-04', 30], ['2026-12', 31]]) {
    const dates = monthDates(month);
    assert.equal(dates.length, length);
    assert.equal(dates.at(-1), month + '-' + length);
    assert.ok(dates.every(isCalendarDate));
  }
  for (const date of ['0000-01-01', '2026-00-01', '2026-13-01', '2026-10-00', '2026-11-31',
    '2026-02-29', '2024-2-29', '2026-10-24T00:00:00Z', '24.10', undefined]) {
    assert.equal(isCalendarDate(date), false);
  }
  assert.deepEqual(dateFields('2024-02-29'), { isoDate: '2024-02-29', rawDate: '2024-02-29', date: '29.02', day: 29 });
  assert.equal(getLessonTimestamp({ rawDate: '2026-01-01' }) - getLessonTimestamp('2025-12-31'), 86400000);
  const range = { mode: 'range', start: '2025-12-31', end: '2026-01-01' };
  assert.deepEqual(['2025-12-30', range.start, range.end, '2026-01-02'].map(date => containsDate(range, date)),
    [false, true, true, false]);
  assert.equal(validPeriod({ ...range, start: '2026-01-02' }), false);
});

const studentId = 'student_a';
const snapshot = {
  group: { id: 'g' }, students: [{ id: studentId, groupId: 'g' }],
  lessons: ['2026-10-24', '2026-11-24', '2027-10-24', null].map((rawDate, index) =>
    ({ groupId: 'g', journalId: 'j', rawDate, id: String(index), hours: 2 })),
  grades: ['0', '0', '1', '2', '3', 'missing', '1'].map((lessonId, i) =>
    ({ studentId, lessonId, hourIndex: i === 6 ? 3 : i === 1 ? 2 : 1, attendance: 'ABSENT' })),
  overrides: {}
};

test('each valid linked ABSENT contributes one hour on its full date only', () => {
  for (const [month, expected] of [['2026-10', 2], ['2026-11', 1], ['2027-10', 1]]) {
    const report = aggregateAttendance(snapshot, { mode: 'month', month });
    assert.equal(report.groupTotals.grandTotal, expected);
    assert.equal(report.byStudent.get(studentId)['Н/У'], expected);
  }
  assert.equal(aggregateAttendance(snapshot, { mode: 'all' }).groupTotals.grandTotal, 4);
  assert.equal(aggregateAttendance(snapshot, { mode: 'range', start: '2026-10-25', end: '2026-11-24' }).groupTotals.grandTotal, 1);
});

test('reasons, manual hours, cleared cells and reset preserve journal hours', () => {
  const date = '2026-10-24';
  const key = studentId + '_' + date;
  const calculate = overrides => aggregateAttendance({ ...snapshot, overrides }, { mode: 'month', month: '2026-10' });
  for (const reason of reasons) {
    const report = calculate({ [key]: { reason, customHours: 5 } });
    assert.equal(report.getEntry(studentId, date).journalHours, 2);
    assert.equal(report.groupTotals.grandTotal, reason === 'Сп' ? 0 : 5);
    assert.equal(report.groupTotals.freeDays, reason === 'Сп' ? 1 : 0);
  }
  assert.equal(calculate({ [key]: { cleared: true } }).getEntry(studentId, date), null);
  assert.equal(calculate({ [key]: { reason: 'Б' } }).groupTotals.excusedTotal, 2);
  assert.equal(calculate({}).groupTotals['Н/У'], 2);
});
