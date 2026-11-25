import test from 'node:test';
import assert from 'node:assert/strict';
import { createJournalRepository, getGradeHourIndex, getLessonSubjectId } from '../src/data/journalRepository.js';

function fixture(entries = {}) {
  const values = new Map(Object.entries(entries));
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, raw) => values.set(key, raw),
    removeItem: (key) => values.delete(key)
  };
  return { values, storage, repo: createJournalRepository(() => storage) };
}

test('absent keys supply shared defaults without writing on read', () => {
  const { values, repo } = fixture();
  for (const name of ['students', 'lessons', 'grades']) assert.ok(repo.read(name).value.length);
  assert.ok(repo.read('configs').value['subj-db'].labsCount);
  assert.equal(repo.read('completions').value['subj-kp_s1_LAB_1'], true);
  assert.equal(values.size, 0);
});

test('empty collections survive reopening under all seven original keys', () => {
  const { values, storage, repo } = fixture();
  const keys = {
    students: 'vgtk_students', lessons: 'vgtk_lessons', grades: 'vgtk_grades',
    overrides: 'vgtk_form6_overrides', configs: 'vgtk_works_config_by_subject',
    completions: 'vgtk_works_completion_by_subject', crossMarks: 'vgtk_works_cross_marks'
  };
  const reopened = createJournalRepository(() => storage);
  for (const [name, key] of Object.entries(keys)) {
    const empty = Array.isArray(repo.read(name).value) ? [] : {};
    assert.ok(repo.write({ [name]: empty }).ok);
    assert.equal(values.get(key), JSON.stringify(empty));
    assert.deepEqual(reopened.read(name).value, empty);
  }
});

test('legacy records keep their fields and receive no extra demo rows', () => {
  const lessons = [{ id: 'old', date: '24.10', custom: true }];
  const grades = [{ lessonId: 'old', studentId: 's1', grade: '7' }];
  const { repo, values } = fixture({
    vgtk_lessons: JSON.stringify(lessons), vgtk_grades: JSON.stringify(grades)
  });
  for (let i = 0; i < 2; i++) {
    assert.deepEqual(repo.read('lessons').value, lessons);
    assert.deepEqual(repo.read('grades').value, grades);
  }
  assert.equal(values.get('vgtk_lessons'), JSON.stringify(lessons));
  assert.equal(getLessonSubjectId(lessons[0]), 'subj-kp');
  assert.equal(getGradeHourIndex(grades[0]), 1);
});

test('malformed JSON and incompatible shapes block writes and preserve original bytes', () => {
  for (const raw of ['', '{', 'null', '{}', '[null]']) {
    const { repo, values } = fixture({ vgtk_grades: raw });
    assert.equal(repo.read('grades').error.code, 'invalid');
    assert.equal(repo.write({ lessons: [], grades: [] }).error.code, 'invalid');
    assert.equal(values.get('vgtk_grades'), raw);
    assert.equal(values.has('vgtk_lessons'), false);
  }
});

test('storage access failures are reported on both paths', () => {
  const repo = createJournalRepository(() => { throw new Error('access denied'); });
  assert.equal(repo.read('students').error.code, 'read');
  assert.equal(repo.write({ students: [] }).error.code, 'read');
});

test('a failed second write restores the previous data, including an absent key', () => {
  for (const raw of [null, '[ { "id": "old" } ]']) {
    const { repo, storage, values } = fixture();
    if (raw !== null) values.set('vgtk_lessons', raw);
    storage.setItem = (key, value) => {
      if (key === 'vgtk_grades') throw new Error('quota');
      values.set(key, value);
    };
    assert.equal(repo.write({ lessons: [], grades: [] }).error.code, 'write');
    assert.equal(storage.getItem('vgtk_lessons'), raw);
    assert.equal(values.has('vgtk_grades'), false);
  }
});

test('a stale view cannot overwrite a newer change from another cabinet', () => {
  const { repo, storage } = fixture({ vgtk_grades: '[]' });
  const previous = repo.read('grades');
  const other = createJournalRepository(() => storage);
  const grades = [{ lessonId: 'l1', studentId: 's1', hourIndex: 1, grade: '9' }];
  const changes = { grades, overrides: { s1_24: { reason: 'Б' } }, completions: { 'subj-kp_s1_PR_1': true } };
  assert.ok(other.write(changes).ok);
  assert.equal(repo.write({ grades: [] }, { grades: previous.raw }).error.code, 'conflict');
  for (const [name, value] of Object.entries(changes)) assert.deepEqual(repo.read(name).value, value);
});
