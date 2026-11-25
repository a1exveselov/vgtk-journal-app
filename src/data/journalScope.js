// Доменные ошибки перехватываются на границе публичного API репозитория.
export class JournalScopeError extends Error {
  constructor(key, message) {
    super(message);
    this.code = 'scope';
    this.key = key;
  }
}

export function requireScope(condition, key, message) {
  if (!condition) throw new JournalScopeError(key, message);
}

const isId = (value) => typeof value === 'string' && value.trim().length > 0;
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function indexBy(records, field, key) {
  requireScope(Array.isArray(records), key, 'Ожидался список записей.');
  const index = new Map();
  for (const row of records) {
    const id = row?.[field];
    requireScope(isId(id) && !index.has(id), key, `Пустой или повторный ${field}: ${id}.`);
    index.set(id, row);
  }
  return index;
}

function sameAssignment(row, journal) {
  return journal && row.groupId === journal.groupId && row.subjectId === journal.subjectId;
}

export function gradeHour(grade) {
  return grade.hourIndex === undefined ? 1 : grade.hourIndex;
}

export function validateCell(student, lesson, hour) {
  requireScope(student && lesson && student.groupId === lesson.groupId,
    'grades', 'Учащийся и занятие должны принадлежать одной группе.');
  requireScope(Number.isInteger(hour) && hour >= 1 && hour <= lesson.hours,
    'grades', 'Час отметки вне диапазона занятия.');
}

function validateWorks(rows, name, index) {
  for (const [journalId, perStudent] of Object.entries(rows)) {
    const journal = index.journals.get(journalId);
    requireScope(journal && isRecord(perStudent), name, 'Неизвестный журнал или неверная структура работ.');
    for (const [studentId, works] of Object.entries(perStudent)) {
      requireScope(index.students.get(studentId)?.groupId === journal.groupId && isRecord(works),
        name, 'Неверная принадлежность учащегося или структура работ.');
      for (const [workId, value] of Object.entries(works)) {
        const valid = name === 'completions' ? typeof value === 'boolean' : isRecord(value);
        requireScope(isId(workId) && valid, name, 'Неверная запись работы.');
      }
    }
  }
}

export function buildScopeIndex(catalog, data) {
  const index = {
    groups: indexBy(catalog.groups, 'id', 'groups'),
    journals: indexBy(catalog.journals, 'id', 'journals'),
    sheets: indexBy(catalog.sheets, 'sheetId', 'sheets'),
    students: indexBy(data.students, 'id', 'students'),
    lessons: indexBy(data.lessons, 'id', 'lessons')
  };
  indexBy(catalog.sheets, 'id', 'sheets');
  requireScope(Array.isArray(catalog.curatorGroupIds), 'curatorGroupIds', 'Ожидался список групп куратора.');
  for (const id of catalog.curatorGroupIds) {
    requireScope(index.groups.has(id), 'curatorGroupIds', 'Неизвестная группа куратора.');
  }
  for (const journal of catalog.journals) {
    requireScope(isId(journal.subjectId) && index.groups.has(journal.groupId),
      'journals', 'Журнал должен иметь дисциплину и известную группу.');
  }
  for (const sheet of catalog.sheets) {
    requireScope(typeof sheet.isMain === 'boolean' && sameAssignment(sheet, index.journals.get(sheet.journalId)),
      'sheets', `Назначение листа ${sheet.sheetId} расходится с журналом.`);
  }
  for (const student of data.students) {
    requireScope(index.groups.has(student.groupId), 'students', `Неизвестная группа учащегося ${student.id}.`);
  }
  for (const lesson of data.lessons) {
    requireScope(sameAssignment(lesson, index.journals.get(lesson.journalId)) &&
      (lesson.sheetId === undefined || index.sheets.get(lesson.sheetId)?.journalId === lesson.journalId),
    'lessons', `Назначение занятия ${lesson.id} расходится с журналом.`);
    requireScope([1, 2].includes(lesson.hours), 'lessons', 'Занятие должно содержать один или два часа.');
  }
  const cells = new Set();
  for (const g of data.grades) {
    const hour = gradeHour(g);
    validateCell(index.students.get(g.studentId), index.lessons.get(g.lessonId), hour);
    const cell = JSON.stringify([g.studentId, g.lessonId, hour]);
    requireScope(!cells.has(cell), 'grades', 'Две отметки в одной ячейке.');
    cells.add(cell);
    requireScope((g.attendance === 'ABSENT' && g.grade === null) ||
      (g.attendance === 'PRESENT' && (typeof g.grade === 'string' ? g.grade.trim() !== '' : Number.isFinite(g.grade))),
    'grades', 'Ожидалась оценка или час отсутствия.');
  }
  for (const [key, value] of Object.entries(data.overrides)) {
    const cut = key.lastIndexOf('_');
    requireScope(cut > 0 && index.students.has(key.slice(0, cut)) &&
      /^(?:[1-9]|[12]\d|3[01])$/.test(key.slice(cut + 1)) && isRecord(value),
    'overrides', 'Некорректная ссылка формы № 6.');
  }
  for (const [id, cfg] of Object.entries(data.configs)) {
    requireScope(index.journals.has(id) && isRecord(cfg) && typeof cfg.initialized === 'boolean' &&
      [cfg.labsCount, cfg.practicalsCount].every(n => Number.isInteger(n) && n >= 0 && n <= 25),
    'configs', 'Некорректная конфигурация работ журнала.');
  }
  validateWorks(data.completions, 'completions', index);
  validateWorks(data.crossMarks, 'crossMarks', index);
  return index;
}

export function selectScope(index, data, context) {
  const fields = Object.keys(context ?? {});
  requireScope(fields.length === 1, 'context', 'Укажите ровно один идентификатор контекста.');
  const kind = fields[0];
  const id = context[kind];
  const sheet = kind === 'sheetId' ? index.sheets.get(id) : undefined;
  const student = kind === 'studentId' ? index.students.get(id) : undefined;
  const journal = index.journals.get(sheet?.journalId ?? (kind === 'journalId' ? id : undefined));
  const group = index.groups.get(journal?.groupId ?? student?.groupId ?? (kind === 'groupId' ? id : undefined));
  requireScope(group, 'context', 'Не удалось однозначно определить контекст журнала.');
  const journals = journal ? [journal] : [...index.journals.values()].filter(j => j.groupId === group.id);
  const journalIds = new Set(journals.map(j => j.id));
  const students = student ? [student] : data.students.filter(s => s.groupId === group.id);
  const studentIds = new Set(students.map(s => s.id));
  const lessons = data.lessons.filter(l => journalIds.has(l.journalId));
  const lessonIds = new Set(lessons.map(l => l.id));
  const entriesForJournals = (rows) => Object.entries(rows).filter(([key]) => journalIds.has(key));
  const works = (rows) => Object.fromEntries(entriesForJournals(rows).map(([key, perStudent]) =>
    [key, Object.fromEntries(Object.entries(perStudent).filter(([sid]) => studentIds.has(sid)))]));
  return {
    group, journal, sheet, journals, students, lessons,
    sheets: [...index.sheets.values()].filter(s => journalIds.has(s.journalId)),
    grades: data.grades.filter(g => studentIds.has(g.studentId) && lessonIds.has(g.lessonId)),
    overrides: Object.fromEntries(Object.entries(data.overrides).filter(([key]) =>
      studentIds.has(key.slice(0, key.lastIndexOf('_'))))),
    configs: Object.fromEntries(entriesForJournals(data.configs)),
    completions: works(data.completions), crossMarks: works(data.crossMarks)
  };
}

export function updateSubgroups(students, groupId, updates) {
  const changes = indexBy(updates, 'id', 'students');
  const members = new Set(students.filter(s => s.groupId === groupId).map(s => s.id));
  for (const [id, row] of changes) {
    requireScope(members.has(id) && [1, 2].includes(row.subgroup),
      'students', 'Проверьте принадлежность учащегося и номер подгруппы.');
  }
  return students.map(s => changes.has(s.id) ? { ...s, subgroup: changes.get(s.id).subgroup } : s);
}
