import { useEffect, useState } from 'react';
import { mockGrades, mockLessons, mockStudents } from '../mocks/initialData.js';
import { createStorage } from './storage.js';

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isRecordList = (value) => Array.isArray(value) && value.every(isObject);
const definitions = {
  students: { key: 'vgtk_students', defaultValue: mockStudents, valid: isRecordList },
  lessons: { key: 'vgtk_lessons', defaultValue: mockLessons, valid: isRecordList },
  grades: { key: 'vgtk_grades', defaultValue: mockGrades, valid: isRecordList },
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
