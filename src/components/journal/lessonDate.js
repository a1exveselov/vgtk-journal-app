import { isCalendarDate, lessonDate } from '../../data/period.js';

export function getLessonTimestamp(value) {
  const date = typeof value === 'string' ? value : lessonDate(value);
  return isCalendarDate(date) ? Date.parse(date + 'T00:00:00Z') : -Infinity;
}
