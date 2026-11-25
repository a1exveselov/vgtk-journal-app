import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { currentUser, mockGroups, mockJournals, mockGrades, mockGrades31, mockGrades32, mockLessons, mockStudents } from '../mocks/initialData.js';
import { createStorage } from './storage.js';
import { buildScopeIndex, gradeHour, JournalScopeError, requireScope, selectScope,
  updateSubgroups, validateCell } from './journalScope.js';

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isRecordList = (value) => Array.isArray(value) && value.every(isObject);
const definitions = {
  students: { key: 'vgtk_students', defaultValue: mockStudents.filter(s => s.groupId === 'group-1'), valid: isRecordList },
  lessons: { key: 'vgtk_lessons', defaultValue: mockLessons.filter(l => l.groupId === 'group-1'), valid: isRecordList },
  grades: { key: 'vgtk_grades', defaultValue: mockGrades31, valid: isRecordList },
  overrides: { key: 'vgtk_form6_overrides', defaultValue: {}, valid: isObject },
  configs: {
    key: 'vgtk_works_config_by_subject',
    defaultValue: {
      'subj-kp': { initialized: true, labsCount: 4, practicalsCount: 3 },
      'subj-db': { initialized: true, labsCount: 5, practicalsCount: 2 },
      'subj-web': { initialized: true, labsCount: 6, practicalsCount: 0 }
    },
    valid: isObject
  },
  completions: {
    key: 'vgtk_works_completion_by_subject',
    defaultValue: {
      'subj-kp_s1_LAB_1': true,
      'subj-kp_s1_LAB_2': true,
      'subj-kp_s1_PR_1': true,
      'subj-kp_s4_LAB_1': true,
      'subj-db_s1_LAB_1': true,
      'subj-web_s1_LAB_1': true,
      'subj-web_s6_LAB_1': true
    },
    valid: isObject
  },
  crossMarks: { key: 'vgtk_works_cross_marks', defaultValue: {}, valid: isObject }
};

export const createJournalRepository = (getStorage) => createStorage(definitions, getStorage);
// Значения для чтения старых записей без миграции исходных объектов.
export const getLessonSubjectId = (lesson) => lesson.subjectId || 'subj-kp';
export const getGradeHourIndex = (grade) => grade.hourIndex || 1;
const repository = createJournalRepository();
const changeEvent = 'vgtk-journal-change';

function load(names) {
  const data = {};
  const versions = {};
  for (const name of names) {
    const result = repository.read(name);
    if (!result.ok) return { data: {}, error: result.error };
    data[name] = result.value;
    versions[name] = result.raw;
  }
  return { data, versions };
}

export function useJournal(names) {
  const [snapshot, setSnapshot] = useState(() => load(names));
  const [saveError, setSaveError] = useState(null);
  useEffect(() => {
    const refresh = () => setSnapshot(load(names));
    const onStorage = (event) => {
      if (event.key === null || names.some((name) => definitions[name].key === event.key)) refresh();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(changeEvent, refresh);
    refresh();
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(changeEvent, refresh);
    };
  }, [names]);

  function save(changes) {
    if (snapshot.error) return false;
    const result = repository.write(changes, snapshot.versions);
    setSaveError(result.ok ? null : result.error);
    window.dispatchEvent(new Event(changeEvent));
    return result.ok;
  }
  return { ...snapshot, save, saveError };
}

const demoCatalog = {
  groups: mockGroups, journals: mockJournals, sheets: currentUser.teachingSubjects,
  curatorGroupIds: currentUser.curatorGroupIds
};
const v2 = {
  students: { key: 'vgtk_v2_students', defaultValue: mockStudents, valid: isRecordList },
  lessons: { key: 'vgtk_v2_lessons', defaultValue: mockLessons, valid: isRecordList },
  grades: { key: 'vgtk_v2_grades', defaultValue: mockGrades, valid: isRecordList },
  overrides: { key: 'vgtk_v2_form6_overrides', defaultValue: {}, valid: isObject },
  configs: {
    key: 'vgtk_v2_works_config_by_journal', valid: isObject,
    defaultValue: {
      'journal-1': { initialized: true, labsCount: 4, practicalsCount: 3 },
      'journal-2': { initialized: true, labsCount: 5, practicalsCount: 2 },
      'journal-3': { initialized: true, labsCount: 6, practicalsCount: 0 }
    }
  },
  completions: {
    key: 'vgtk_v2_works_completion_by_journal', valid: isObject,
    defaultValue: {
      'journal-1': { s1: { LAB_1: true, LAB_2: true, PR_1: true }, s4: { LAB_1: true } },
      'journal-2': { s1: { LAB_1: true } },
      'journal-3': { s1: { LAB_1: true }, s6: { LAB_1: true } }
    }
  },
  crossMarks: { key: 'vgtk_v2_works_cross_marks', defaultValue: {}, valid: isObject }
};

function workEntry(rows, journalId, studentId, workId, value) {
  const perJournal = Object.hasOwn(rows, journalId) ? rows[journalId] : {};
  const perStudent = Object.hasOwn(perJournal, studentId) ? perJournal[studentId] : {};
  const works = { ...perStudent, [workId]: value };
  if (value === null) delete works[workId];
  return { ...rows, [journalId]: { ...perJournal, [studentId]: works } };
}

function lessonChanges(data, view, command) {
  const { journal, sheet } = view;
  const { type, lessonId, fields } = command;
  const previous = view.lessons.find(l => l.id === lessonId);
  if (type !== 'addLesson') requireScope(previous, 'lessons', 'Занятие отсутствует в этом журнале.');
  if (type === 'deleteLesson') {
    return {
      lessons: data.lessons.filter(l => l.id !== lessonId),
      grades: data.grades.filter(g => g.lessonId !== lessonId)
    };
  }
  requireScope(isObject(fields), 'lessons', 'Ожидались поля занятия.');
  const editable = ['type', 'date', 'rawDate', 'day', 'hours', 'topic', 'homework', 'isSubgroupOnly'];
  const patch = Object.fromEntries(Object.entries(fields).filter(([key]) => editable.includes(key)));
  if (type === 'addLesson') {
    requireScope(sheet, 'context', 'Для создания занятия выберите лист преподавателя.');
    const lesson = { ...patch, id: lessonId, journalId: journal.id, groupId: journal.groupId,
      subjectId: journal.subjectId, sheetId: sheet.sheetId, createdByMain: sheet.isMain };
    return { lessons: [...data.lessons, lesson] };
  }
  const changes = { lessons: data.lessons.map(l => l.id === lessonId ? { ...l, ...patch } : l) };
  if (previous.hours === 2 && patch.hours === 1) {
    changes.grades = data.grades.filter(g => g.lessonId !== lessonId || gradeHour(g) === 1);
  }
  return changes;
}

function scopedChanges(data, view, context, command, catalog) {
  requireScope(isObject(command) && !Object.hasOwn(context, 'studentId'), 'context',
    'Для изменения требуется контекст преподавателя или куратора.');
  const { type, studentId, lessonId, workId, value } = command;
  const { group, journal } = view;
  const student = view.students.find(s => s.id === studentId);
  if (type === 'setSubgroups') {
    requireScope(journal, 'context', 'Выберите журнал для изменения подгрупп.');
    return { students: updateSubgroups(data.students, group.id, command.updates) };
  }
  if (type === 'setOverride') {
    requireScope(context.groupId === group.id && catalog.curatorGroupIds.includes(group.id) && student,
      'overrides', 'Учащийся должен принадлежать выбранной группе куратора.');
    requireScope(Number.isInteger(command.day) && command.day >= 1 && command.day <= 31 &&
      (value === null || isObject(value)), 'overrides', 'Некорректная корректировка формы № 6.');
    const key = `${studentId}_${command.day}`;
    const overrides = { ...data.overrides, [key]: value };
    if (value === null) delete overrides[key];
    return { overrides };
  }
  requireScope(journal, 'context', 'Выберите конкретный журнал или лист.');
  switch (type) {
    case 'addLesson':
    case 'updateLesson':
    case 'deleteLesson':
      return lessonChanges(data, view, command);
    case 'setGrade': {
      const hour = gradeHour(command);
      validateCell(student, view.lessons.find(l => l.id === lessonId), hour);
      const grades = data.grades.filter(g => !(g.studentId === studentId && g.lessonId === lessonId && gradeHour(g) === hour));
      if (value !== null) {
        requireScope(isObject(value), 'grades', 'Передайте отметку или null для очистки.');
        grades.push({ ...value, studentId, lessonId, hourIndex: hour });
      }
      return { grades };
    }
    case 'setConfig':
      return { configs: { ...data.configs, [journal.id]: value } };
    case 'setWork': {
      const mark = command.crossMark ?? null;
      requireScope(student && typeof workId === 'string' && workId.trim() && typeof value === 'boolean' &&
        (mark === null || (value && isObject(mark))), 'completions', 'Некорректные параметры сдачи работы.');
      return {
        completions: workEntry(data.completions, journal.id, studentId, workId, value),
        crossMarks: workEntry(data.crossMarks, journal.id, studentId, workId, mark)
      };
    }
    default:
      throw new JournalScopeError('command', 'Неизвестная операция журнала.');
  }
}

function scopeResult(operation) {
  try {
    return operation();
  } catch (error) {
    if (!(error instanceof JournalScopeError)) throw error;
    return { ok: false, error: { code: error.code, key: error.key, message: error.message } };
  }
}

const scopedChange = 'vgtk-v2-journal-change';
const scopedKeys = new Set(Object.values(v2).map(def => def.key));

export function createScopedJournalRepository({
  getStorage, catalog = demoCatalog, eventTarget = globalThis.window ?? new EventTarget()
} = {}) {
  const storage = createStorage(v2, getStorage);
  // Версии всех зависимостей и исходный контекст остаются внутри экземпляра.
  const issued = new WeakMap();

  function loadScoped() {
    const data = {};
    const versions = {};
    for (const name of Object.keys(v2)) {
      const result = storage.read(name);
      if (!result.ok) return result;
      data[name] = result.value;
      versions[name] = result.raw;
    }
    // В частично заполненном v2 этапа 03B могут отсутствовать связи новой демогруппы.
    if (versions.grades === null && (versions.students !== null || versions.lessons !== null)) {
      const available = mockGrades32.filter(g =>
        data.students.some(s => s.id === g.studentId && s.groupId === 'group-2') &&
        data.lessons.some(l => l.id === g.lessonId && l.journalId === 'journal-4'));
      data.grades = [...mockGrades31, ...available];
    }
    return { ok: true, data, versions, index: buildScopeIndex(catalog, data) };
  }

  function read(context) {
    return scopeResult(() => {
      const state = loadScoped();
      if (!state.ok) return state;
      const snapshot = structuredClone(selectScope(state.index, state.data, context));
      issued.set(snapshot, {
        context: { ...context }, versions: state.versions,
        groupId: snapshot.group.id, journalId: snapshot.journal?.id,
        subjectId: snapshot.journal?.subjectId, isMain: snapshot.sheet?.isMain
      });
      return { ok: true, snapshot };
    });
  }

  function mutate(snapshot, command) {
    return scopeResult(() => {
      const token = issued.get(snapshot);
      requireScope(token, 'snapshot', 'Требуется снимок этого экземпляра репозитория.');
      const state = loadScoped();
      if (!state.ok) return state;
      const stale = Object.keys(v2).find(name => state.versions[name] !== token.versions[name]);
      if (stale) return { ok: false, error: { code: 'conflict', key: v2[stale].key,
        message: 'Снимок устарел. Перечитайте журнал.' } };
      const view = selectScope(state.index, state.data, token.context);
      if (view.group.id !== token.groupId || view.journal?.id !== token.journalId ||
        view.journal?.subjectId !== token.subjectId || view.sheet?.isMain !== token.isMain) {
        return { ok: false, error: { code: 'conflict', key: 'context',
          message: 'Учебное назначение изменилось. Перечитайте журнал.' } };
      }
      const changes = scopedChanges(state.data, view, token.context, command, catalog);
      buildScopeIndex(catalog, { ...state.data, ...changes });
      const result = storage.write(changes, state.versions);
      if (result.ok || result.error.code === 'partial') eventTarget.dispatchEvent(new Event(scopedChange));
      return result;
    });
  }

  function subscribe(listener) {
    const onStorage = (event) => {
      if (event.key === null || scopedKeys.has(event.key)) listener();
    };
    eventTarget.addEventListener('storage', onStorage);
    eventTarget.addEventListener(scopedChange, listener);
    return () => {
      eventTarget.removeEventListener('storage', onStorage);
      eventTarget.removeEventListener(scopedChange, listener);
    };
  }
  return { read, mutate, subscribe };
}

export const schemaNotice = 'Журнал использует тестовую схему v2. Прежние записи сохранены отдельно.';

// React хранит один результат чтения между уведомлениями, включая исходный снимок для mutate.
function openScopedView(readView, id) {
  const repository = createScopedJournalRepository();
  let view = readView(repository, id);
  const listeners = new Set();
  function refresh() {
    view = readView(repository, id);
    for (const listener of listeners) listener();
  }
  return {
    getSnapshot: () => view,
    subscribe(listener) {
      listeners.add(listener);
      const unsubscribe = repository.subscribe(refresh);
      refresh();
      return () => {
        listeners.delete(listener);
        unsubscribe();
      };
    },
    mutate: repository.mutate,
    refresh
  };
}

export function useScopedRead(readView, id) {
  const store = useMemo(() => openScopedView(readView, id), [readView, id]);
  const view = useSyncExternalStore(store.subscribe, store.getSnapshot);
  return { ...view, mutate: store.mutate, refresh: store.refresh };
}
