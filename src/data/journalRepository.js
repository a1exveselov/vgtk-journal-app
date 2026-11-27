import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { currentUser, mockGroups, mockJournals, mockGrades, mockGrades31, mockGrades32, mockLessons, mockStudents } from '../mocks/initialData.js';
import { createStorage } from './storage.js';
import { buildScopeIndex, gradeHour, JournalScopeError, requireScope, selectScope,
  updateSubgroups, validateCell } from './journalScope.js';

import { dateFields, isCalendarDate, lessonDate } from './period.js';
import { validOverride } from './attendance.js';
import { readSchedule } from './scheduleRepository.js';
import { attendanceSignatures, collegeTime, currentCompletion, fitsScheduleRef, hasTopic,
  lessonScopeSignature, lessonTiming, ownEntry, resolveScheduleIntent } from './lessonCompletion.js';

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
// Только исходный демонабор имеет подтверждённый год. Сохранённые строки могут совпадать с ним по ID.
const datedDemoLessons = mockLessons.map(lesson => {
  const [day, month] = lesson.date.split('.');
  return { ...lesson, ...dateFields(`2026-${month}-${day}`) };
});
const v2 = {
  students: { key: 'vgtk_v2_students', defaultValue: mockStudents, valid: isRecordList },
  lessons: { key: 'vgtk_v2_lessons', defaultValue: datedDemoLessons, valid: isRecordList },
  grades: { key: 'vgtk_v2_grades', defaultValue: mockGrades, valid: isRecordList },
  overrides: { key: 'vgtk_v2_form6_overrides', defaultValue: {}, valid: isObject },
  byDate: { key: 'vgtk_v2_form6_overrides_by_date', defaultValue: { entries: {}, bindings: {} },
    valid: value => isObject(value) && isObject(value.entries) && isObject(value.bindings) },
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

function lessonChanges(data, view, command, resolveSchedule) {
  const { journal, sheet } = view;
  const { type, lessonId, fields, scheduleIntent } = command;
  const previous = data.lessons.find(l => l.id === lessonId && l.journalId === journal.id);
  if (type !== 'addLesson') requireScope(previous, 'lessons', 'Занятие отсутствует в этом журнале.');
  if (type === 'deleteLesson') {
    return {
      lessons: data.lessons.filter(l => l.id !== lessonId),
      grades: data.grades.filter(g => g.lessonId !== lessonId)
    };
  }
  requireScope(isObject(fields), 'lessons', 'Ожидались поля занятия.');
  const editable = ['type', 'hours', 'topic', 'homework', 'isSubgroupOnly'];
  const patch = Object.fromEntries(Object.entries(fields).filter(([key]) => editable.includes(key)));
  if (type === 'addLesson' || ['isoDate', 'rawDate', 'date', 'day'].some(field => Object.hasOwn(fields, field))) {
    const date = fields.isoDate ?? fields.rawDate;
    requireScope(isCalendarDate(date) && (fields.rawDate === undefined || fields.rawDate === date),
      'lessons', 'Укажите полную календарную дату занятия.');
    if (previous && !lessonDate(previous)) {
      patch.originalDateFields = Object.fromEntries(['date', 'day', 'rawDate'].filter(k => Object.hasOwn(previous, k))
        .map(k => [k, previous[k]]));
    }
    Object.assign(patch, dateFields(date));
  }
  if (type === 'addLesson') {
    requireScope(sheet, 'context', 'Для создания занятия выберите лист преподавателя.');
    const lesson = { ...patch, id: lessonId, journalId: journal.id, groupId: journal.groupId,
      subjectId: journal.subjectId, sheetId: sheet.sheetId, createdByMain: sheet.isMain,
      completionBySheet: { [sheet.sheetId]: { status: 'draft', confirmations: {} } } };
    if (scheduleIntent !== undefined) {
      const match = resolveSchedule(scheduleIntent);
      requireScope(match?.kind === 'missing' && fitsScheduleRef(lesson, match.ref),
        'lessons', 'Расписание или журнал изменились. Проверьте событие перед созданием занятия.');
      lesson.scheduleRefsBySheet = { [sheet.sheetId]: match.ref };
    }
    return { lessons: [...data.lessons, lesson] };
  }
  const updated = { ...previous, ...patch };
  if (previous.scheduleRefsBySheet && lessonScopeSignature(previous) !== lessonScopeSignature(updated)) {
    delete updated.scheduleRefsBySheet;
  }
  const changes = { lessons: data.lessons.map(l => l.id === lessonId ? updated : l) };
  if (previous.hours === 2 && patch.hours === 1) {
    changes.grades = data.grades.filter(g => g.lessonId !== lessonId || gradeHour(g) === 1);
  }
  return changes;
}

function completionChanges(data, view, command, time, resolveSchedule) {
  const { sheet, journal } = view;
  requireScope(sheet, 'context', 'Для этого действия выберите лист преподавателя.');
  const { type, lessonId, hourIndex, value, scheduleIntent } = command;
  const lesson = data.lessons.find(l => l.id === lessonId && l.journalId === journal.id);
  requireScope(lesson, 'lessons', 'Занятие отсутствует в этом журнале.');
  const id = sheet.sheetId;
  const previous = ownEntry(lesson.completionBySheet, id);
  const replace = updated => ({ lessons: data.lessons.map(l => l === lesson ? updated : l) });
  if (type === 'bindSchedule') {
    const match = resolveSchedule(scheduleIntent);
    if (match?.kind === 'linked' && match.lessonId === lessonId) return {};
    requireScope(match?.kind === 'ambiguous' && match.bindable.some(row => row.id === lessonId),
      'lessons', 'Привязка не подтверждена. Проверьте назначение, дату, часы и другие привязки.');
    const updated = { ...lesson, scheduleRefsBySheet: { ...lesson.scheduleRefsBySheet, [id]: match.ref } };
    if (lessonTiming(updated, time) === 'future' && updated.completionBySheet) {
      updated.completionBySheet = Object.fromEntries(Object.entries(updated.completionBySheet)
        .map(([sheetId, entry]) => [sheetId, { ...entry, status: 'draft' }]));
    }
    return replace(updated);
  }
  const signatures = attendanceSignatures(lesson, sheet, view.students, view.grades);
  const entry = currentCompletion(lesson, previous, signatures) ?? { status: 'draft', confirmations: {} };
  if (type === 'confirmAttendance') {
    requireScope(Number.isInteger(hourIndex) && hourIndex >= 1 && hourIndex <= lesson.hours && typeof value === 'boolean',
      'lessons', 'Укажите академический час и состояние подтверждения.');
    if (value) {
      requireScope(signatures[hourIndex], 'students', 'Уточните состав подгрупп перед подтверждением посещаемости.');
      entry.confirmations[hourIndex] = signatures[hourIndex];
    } else {
      if (!previous) return {};
      delete entry.confirmations[hourIndex];
      entry.status = 'draft';
    }
  } else if (type === 'completeLesson') {
    requireScope(time && isCalendarDate(lessonDate(lesson)) && lessonTiming(lesson, time) !== 'future',
      'lessons', 'Подтвердите дату и дождитесь окончания занятия.');
    requireScope(hasTopic(lesson), 'lessons', 'Укажите и сохраните тему занятия.');
    requireScope([1, 2].includes(lesson.hours) && Object.keys(entry.confirmations).length === lesson.hours,
      'lessons', 'Подтвердите посещаемость отдельно за каждый академический час.');
    entry.status = 'completed';
  } else {
    if (!previous) return {};
    entry.status = 'draft';
  }
  if (JSON.stringify(previous) === JSON.stringify(entry)) return {};
  return replace({ ...lesson, completionBySheet: { ...lesson.completionBySheet, [id]: entry } });
}

// Затронутые ключи пишутся одной операцией хранилища с проверкой снимка и откатом.
function invalidateCompletion(data, changes, sheets, affects) {
  const { lessons = data.lessons, students = data.students, grades = data.grades } = changes;
  const originals = new Map(data.lessons.map(lesson => [lesson.id, lesson]));
  let invalidated = false;
  const updatedLessons = lessons.map(lesson => {
    if (!lesson.completionBySheet || !affects(lesson)) return lesson;
    let updated = lesson;
    for (const [id, entry] of Object.entries(lesson.completionBySheet)) {
      const sheet = sheets.get(id);
      const original = originals.get(lesson.id);
      const before = currentCompletion(original, entry, attendanceSignatures(original, sheet, data.students, data.grades));
      const valid = currentCompletion(lesson, before, attendanceSignatures(lesson, sheet, students, grades));
      if (JSON.stringify(valid) !== JSON.stringify(entry)) {
        updated = { ...updated, completionBySheet: { ...updated.completionBySheet, [id]: valid } };
        invalidated = true;
      }
    }
    return updated;
  });
  return invalidated ? { ...changes, lessons: updatedLessons } : changes;
}

function scopedChanges(data, view, context, command, catalog, time, resolveSchedule) {
  requireScope(isObject(command) && !Object.hasOwn(context, 'studentId'), 'context',
    'Для изменения требуется контекст преподавателя или куратора.');
  const { type, studentId, lessonId, workId, value } = command;
  const { group, journal } = view;
  const student = view.students.find(s => s.id === studentId);
  if (type === 'setSubgroups') {
    requireScope(journal, 'context', 'Выберите журнал для изменения подгрупп.');
    return { students: updateSubgroups(data.students, group.id, command.updates) };
  }
  if (type === 'setOverride' || type === 'bindOverride') {
    requireScope(context.groupId === group.id && catalog.curatorGroupIds.includes(group.id) && student,
      'overrides', 'Учащийся должен принадлежать выбранной группе куратора.');
    const { date } = command;
    requireScope(isCalendarDate(date), 'byDate', 'Укажите полную календарную дату корректировки.');
    const key = studentId + '_' + date;
    const { entries, bindings } = data.byDate;
    if (type === 'bindOverride') {
      const sourceKey = studentId + '_' + command.day;
      requireScope(Number.isInteger(command.day) && command.day === Number(date.slice(8)) &&
        Object.hasOwn(data.overrides, sourceKey), 'byDate', 'Выберите дату с числом исходной записи.');
      if (bindings[sourceKey] === date) return {};
      requireScope(!Object.hasOwn(bindings, sourceKey) && !Object.hasOwn(entries, key), 'byDate',
        'Исходная запись уже распределена или дата занята корректировкой.');
      const original = data.overrides[sourceKey];
      requireScope(validOverride(original), 'byDate', 'Проверьте причину и часы в исходной корректировке.');
      return { byDate: { entries: { ...entries, [key]: original }, bindings: { ...bindings, [sourceKey]: date } } };
    }
    requireScope(value === null || validOverride(value), 'byDate', 'Проверьте причину и количество часов.');
    const updated = { ...entries, [key]: value };
    if (value === null) delete updated[key];
    return { byDate: { entries: updated, bindings } };
  }
  requireScope(journal, 'context', 'Выберите конкретный журнал или лист.');
  switch (type) {
    case 'addLesson':
    case 'updateLesson':
    case 'deleteLesson':
      return lessonChanges(data, view, command, resolveSchedule);
    case 'confirmAttendance':
    case 'completeLesson':
    case 'reopenLesson':
    case 'bindSchedule':
      return completionChanges(data, view, command, time, resolveSchedule);
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
  getStorage, catalog = demoCatalog, eventTarget = globalThis.window ?? new EventTarget(),
  getSchedule = readSchedule, now = Date.now
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
        subjectId: snapshot.journal?.subjectId, isMain: snapshot.sheet?.isMain, assignmentId: snapshot.sheet?.id
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
        view.journal?.subjectId !== token.subjectId || view.sheet?.isMain !== token.isMain ||
        view.sheet?.id !== token.assignmentId) {
        return { ok: false, error: { code: 'conflict', key: 'context',
          message: 'Учебное назначение изменилось. Перечитайте журнал.' } };
      }
      const timestamp = now();
      const resolveSchedule = intent => {
        if (!view.sheet || !['today', 'tomorrow'].includes(intent?.day)) return null;
        return resolveScheduleIntent(intent, { [intent.day]: getSchedule(intent.day), now: timestamp,
          sheets: catalog.sheets, snapshot: view });
      };
      let changes = scopedChanges(state.data, view, token.context, command, catalog, collegeTime(timestamp), resolveSchedule);
      buildScopeIndex(catalog, { ...state.data, ...changes });
      if (['setGrade', 'setSubgroups', 'updateLesson'].includes(command.type)) {
        changes = invalidateCompletion(state.data, changes, state.index.sheets, command.type === 'setSubgroups'
          ? lesson => lesson.groupId === view.group.id : lesson => lesson.id === command.lessonId);
      }
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
