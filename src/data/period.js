// Календарные даты сравниваются как строки фиксированной длины.
export function monthLength(month) {
  if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return 0;
  const [year, number] = month.split('-').map(Number);
  if (year < 1) return 0;
  if (number === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return [4, 6, 9, 11].includes(number) ? 30 : 31;
}

export function isCalendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const day = Number(value.slice(8));
  return day >= 1 && day <= monthLength(value.slice(0, 7));
}

export function lessonDate(lesson) {
  const value = lesson?.isoDate ?? lesson?.rawDate ?? lesson?.date;
  return isCalendarDate(value) ? value : null;
}

export function dateFields(isoDate) {
  if (!isCalendarDate(isoDate)) throw new RangeError('Некорректная календарная дата.');
  return { isoDate, rawDate: isoDate, date: isoDate.slice(8) + '.' + isoDate.slice(5, 7), day: Number(isoDate.slice(8)) };
}

export const initialPeriod = { mode: 'month', month: '2026-10', start: '', end: '' };

export function validPeriod(period) {
  if (period?.mode === 'all') return true;
  if (period?.mode === 'month') return monthLength(period.month) > 0;
  return period?.mode === 'range' && isCalendarDate(period.start) && isCalendarDate(period.end) && period.start <= period.end;
}

export function containsDate(period, date) {
  if (!isCalendarDate(date) || !validPeriod(period)) return false;
  if (period.mode === 'month') return date.slice(0, 7) === period.month;
  return period.mode === 'all' || (date >= period.start && date <= period.end);
}

export function monthDates(month) {
  return Array.from({ length: monthLength(month) }, (_, i) => month + '-' + String(i + 1).padStart(2, '0'));
}
