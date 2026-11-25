export function getLessonTimestamp(lessonOrDateStr) {
  if (!lessonOrDateStr) return 0;

  if (typeof lessonOrDateStr === 'string') {
    if (lessonOrDateStr.includes('-')) {
      const [y, m, d] = lessonOrDateStr.split('-').map(Number);
      return new Date(y, m - 1, d).getTime();
    }
    if (lessonOrDateStr.includes('.')) {
      const [d, m] = lessonOrDateStr.split('.').map(Number);
      return new Date(2026, m - 1, d).getTime();
    }
  }

  if (lessonOrDateStr.rawDate) {
    const [y, m, d] = lessonOrDateStr.rawDate.split('-').map(Number);
    return new Date(y, m - 1, d).getTime();
  }

  if (lessonOrDateStr.date) {
    const [d, m] = lessonOrDateStr.date.split('.').map(Number);
    return new Date(2026, m - 1, d).getTime();
  }

  return 0;
}
