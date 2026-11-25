import test from 'node:test';
import assert from 'node:assert/strict';
import { createScopedJournalRepository } from '../src/data/journalRepository.js';

const keys = {
  students: 'vgtk_v2_students', lessons: 'vgtk_v2_lessons', grades: 'vgtk_v2_grades',
  overrides: 'vgtk_v2_form6_overrides', configs: 'vgtk_v2_works_config_by_journal',
  completions: 'vgtk_v2_works_completion_by_journal', crossMarks: 'vgtk_v2_works_cross_marks'
};

function memory(entries = {}) {
  const values = new Map(Object.entries(entries));
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, raw) => values.set(key, raw),
    removeItem: key => values.delete(key)
  };
  const eventTarget = new EventTarget();
  return { values, storage, eventTarget, getStorage: () => storage };
}

function fixture() {
  // Обе тройки дали бы одинаковый ключ a_b_c_LAB_1 при склейке через "_".
  const journals = [
    { id: 'a_b', groupId: 'g1', subjectId: 'math' },
    { id: 'a', groupId: 'g2', subjectId: 'math' }
  ];
  const sheets = ['main', 'sub2', 'other'].map((sheetId, i) => {
    const journal = journals[i === 2 ? 1 : 0];
    return { id: 'assignment-' + i, sheetId, journalId: journal.id, groupId: journal.groupId,
      subjectId: journal.subjectId, isMain: i !== 1 };
  });
  const catalog = { groups: [{ id: 'g1', name: 'А' }, { id: 'g2', name: 'Б' }],
    journals, sheets, curatorGroupIds: ['g1', 'g2'] };
  const data = {
    students: [{ id: 'c', groupId: 'g1', subgroup: 1 }, { id: 'b_c', groupId: 'g2', subgroup: 2 }],
    lessons: journals.map((j, i) => ({ id: 'lesson-' + i, subjectId: j.subjectId, groupId: j.groupId,
      journalId: j.id, hours: i === 0 ? 2 : 1 })),
    grades: [], overrides: {}, configs: {}, completions: {}, crossMarks: {}
  };
  const env = memory(Object.fromEntries(Object.entries(data).map(([name, value]) => [keys[name], JSON.stringify(value)])));
  return { ...env, catalog, data, repo: createScopedJournalRepository({ ...env, catalog }) };
}

function read(repo, context) {
  const result = repo.read(context);
  assert.equal(result.ok, true, result.error?.message);
  return result.snapshot;
}
const sheet = { sheetId: 'main' };
const grade = { type: 'setGrade', studentId: 'c', lessonId: 'lesson-0', value: { attendance: 'ABSENT', grade: null } };
function save(repo, context, command) {
  const result = repo.mutate(read(repo, context), command);
  assert.equal(result.ok, true, result.error?.message);
}

test('sheet, journal, group and student resolve exactly; renaming preserves identity', () => {
  const { repo, catalog } = fixture();
  const main = read(repo, sheet);
  assert.equal(main.journal.id, 'a_b');
  assert.deepEqual(read(repo, { sheetId: 'sub2' }).lessons, main.lessons);
  assert.deepEqual(main.lessons.map(l => l.id), ['lesson-0']);
  assert.deepEqual(read(repo, { groupId: 'g2' }).students.map(s => s.id), ['b_c']);
  assert.deepEqual(read(repo, { studentId: 'b_c' }).lessons.map(l => l.id), ['lesson-1']);
  catalog.groups[0].name = 'Новое название';
  assert.equal(read(repo, sheet).journal.id, main.journal.id);
  assert.equal(read(repo, { journalId: 'a_b' }).group.name, 'Новое название');
  for (const ctx of [{}, { sheetId: 'MAIN' }, { sheetId: 'main', groupId: 'g2' }, { subjectId: 'math' }]) {
    assert.equal(repo.read(ctx).error.code, 'scope');
  }
});

test('duplicate IDs and broken links fail before writes', () => {
  for (const key of ['groups', 'journals', 'sheets', 'students', 'lessons']) {
    const { repo, catalog, data, values } = fixture();
    const rows = catalog[key] ?? data[key];
    rows.push({ ...rows[0] });
    if (keys[key]) values.set(keys[key], JSON.stringify(rows));
    assert.equal(repo.read(sheet).error.key, key);
  }
  for (const invalid of [{ journalId: 'missing' }, { groupId: 'g2' }, { subjectId: 'x' }, { sheetId: 'other' }]) {
    const { repo, data, values } = fixture();
    Object.assign(data.lessons[0], invalid);
    values.set(keys.lessons, JSON.stringify(data.lessons));
    assert.equal(repo.read(sheet).error.key, 'lessons');
  }
  const { catalog, repo } = fixture();
  catalog.sheets[0].groupId = 'g2';
  assert.equal(repo.read(sheet).error.key, 'sheets');
});

test('a second journal of the same group and subject remains distinct after reassignment', () => {
  const { repo, catalog, values } = fixture();
  const original = read(repo, sheet);
  catalog.journals.push({ id: 'parallel', groupId: 'g1', subjectId: 'math' });
  catalog.sheets[0].journalId = 'parallel';
  assert.deepEqual(read(repo, sheet).lessons, []);
  assert.equal(read(repo, { sheetId: 'sub2' }).lessons.length, 1);
  assert.equal(repo.mutate(original, grade).error.code, 'conflict');
  assert.equal(values.get(keys.grades), '[]');
});

test('grade identity, absent hour and clear; forged scope and out-of-range writes fail', () => {
  const { repo, values } = fixture();
  const snap = read(repo, sheet);
  snap.group.id = 'g2';
  const before = new Map(values);
  for (const invalid of [{ studentId: 'b_c' }, { lessonId: 'lesson-1' }, { hourIndex: 0 },
    { hourIndex: 3 }, { hourIndex: null }, { value: { attendance: 'PRESENT', grade: '' } }]) {
    assert.equal(repo.mutate(snap, { ...grade, ...invalid }).error.code, 'scope');
  }
  assert.equal(repo.mutate({ ...snap }, grade).error.key, 'snapshot');
  assert.deepEqual(values, before);
  save(repo, sheet, grade);
  save(repo, { sheetId: 'sub2' }, { ...grade, hourIndex: 1, value: {
    attendance: 'PRESENT', grade: '8', isCrossSubgroup: true, markedBySubgroup: 2
  } });
  const rows = read(repo, { studentId: 'c' }).grades;
  assert.equal(rows.length, 1);
  assert.deepEqual([rows[0].studentId, rows[0].lessonId, rows[0].hourIndex], ['c', 'lesson-0', 1]);
  assert.equal(rows[0].markedBySubgroup, 2);
  save(repo, sheet, { ...grade, value: null });
  assert.deepEqual(read(repo, sheet).grades, []);
});

test('scoped lessons preserve sheet authorship, trim hours and delete only related marks', () => {
  const { repo } = fixture();
  save(repo, { sheetId: 'sub2' }, { type: 'addLesson', lessonId: 'new',
    fields: { hours: 2, journalId: 'a', createdByMain: true, type: 'ПР', isSubgroupOnly: true } });
  save(repo, sheet, { ...grade, lessonId: 'new', hourIndex: 2 });
  save(repo, sheet, { type: 'updateLesson', lessonId: 'new', fields: { hours: 1, sheetId: 'other' } });
  const view = read(repo, sheet);
  const added = view.lessons.find(l => l.id === 'new');
  assert.equal(added.createdByMain, false);
  assert.equal(added.sheetId, 'sub2');
  assert.equal(added.isSubgroupOnly, true);
  assert.equal(view.grades.length, 0);
  save(repo, sheet, { ...grade, lessonId: 'new' });
  assert.equal(repo.mutate(read(repo, { journalId: 'a' }), { type: 'deleteLesson', lessonId: 'new' }).ok, false);
  save(repo, sheet, { type: 'deleteLesson', lessonId: 'new' });
  assert.equal(read(repo, sheet).grades.length, 0);
  assert.equal(read(repo, { journalId: 'a' }).lessons.length, 1);
});

test('subgroup patches and Form 6 updates preserve other groups; multiple curator groups', () => {
  const { repo } = fixture();
  const other = read(repo, { groupId: 'g2' }).students;
  const patch = { type: 'setSubgroups', updates: [{ id: 'c', subgroup: 2 }] };
  save(repo, sheet, patch);
  assert.equal(read(repo, sheet).students[0].subgroup, 2);
  assert.deepEqual(read(repo, { groupId: 'g2' }).students, other);
  assert.equal(repo.mutate(read(repo, sheet), { ...patch, updates: [{ id: 'b_c', subgroup: 1 }] }).ok, false);
  const override = { type: 'setOverride', studentId: 'b_c', day: 6, value: { reason: 'Б' } };
  save(repo, { groupId: 'g2' }, override);
  save(repo, { groupId: 'g1' }, { ...override, studentId: 'c' });
  assert.equal(repo.mutate(read(repo, { groupId: 'g1' }), override).ok, false);
  assert.deepEqual(read(repo, { studentId: 'b_c' }).overrides, { b_c_6: { reason: 'Б' } });
});

test('configs and work triples with delimiters remain independent; bool and metadata round-trip', () => {
  const { repo } = fixture();
  const work = { type: 'setWork', studentId: 'c', workId: 'LAB_1', value: true,
    crossMark: { markedBySubgroup: 2, markedByRole: '2 п/г' } };
  const cfg = { type: 'setConfig', value: { initialized: true, labsCount: 2, practicalsCount: 0 } };
  save(repo, sheet, cfg);
  save(repo, { journalId: 'a' }, { ...cfg, value: { ...cfg.value, labsCount: 1 } });
  save(repo, sheet, work);
  save(repo, { journalId: 'a' }, { ...work, studentId: 'b_c', value: false, crossMark: null });
  const first = read(repo, { sheetId: 'sub2' });
  const second = read(repo, { studentId: 'b_c' });
  assert.deepEqual(first.completions, { a_b: { c: { LAB_1: true } } });
  assert.deepEqual(second.completions, { a: { b_c: { LAB_1: false } } });
  assert.deepEqual(first.crossMarks.a_b.c.LAB_1, work.crossMark);
  assert.equal(second.configs.a.labsCount, 1);
  assert.equal(first.configs.a_b.labsCount, 2);
});

test('teacher sheet edits a shared topic, trims and deletes its marks without touching the other journal', () => {
  const { repo } = fixture();
  const secondSheet = { sheetId: 'sub2' };
  const otherSheet = { sheetId: 'other' };
  save(repo, otherSheet, { ...grade, studentId: 'b_c', lessonId: 'lesson-1' });
  const other = read(repo, otherSheet);
  save(repo, secondSheet, { type: 'addLesson', lessonId: 'shared', fields: { hours: 2, topic: 'Тема' } });
  const created = read(repo, secondSheet).lessons.find(l => l.id === 'shared');
  save(repo, sheet, { ...grade, lessonId: 'shared', hourIndex: 2 });
  save(repo, sheet, { type: 'updateLesson', lessonId: 'shared', fields: { hours: 1, topic: 'Новая тема' } });
  const updated = read(repo, secondSheet);
  assert.deepEqual(updated.lessons.find(l => l.id === 'shared'), { ...created, hours: 1, topic: 'Новая тема' });
  assert.deepEqual(updated.grades, []);
  save(repo, sheet, { ...grade, lessonId: 'shared' });
  save(repo, secondSheet, { type: 'deleteLesson', lessonId: 'shared' });
  assert.deepEqual(read(repo, sheet).grades, []);
  assert.deepEqual(read(repo, otherSheet), other);
});

test('failed deletion and conflicting subgroup draft leave stored records available for review and retry', () => {
  const { repo, storage } = fixture();
  const initial = read(repo, sheet);
  const draft = { type: 'setSubgroups', updates: [{ id: 'c', subgroup: 2 }] };
  const other = read(repo, { sheetId: 'other' });
  save(repo, sheet, grade);
  assert.equal(repo.mutate(initial, draft).error.code, 'conflict');
  const current = read(repo, sheet);
  const write = storage.setItem;
  storage.setItem = () => { throw new Error('quota'); };
  assert.equal(repo.mutate(current, { type: 'deleteLesson', lessonId: 'lesson-0' }).error.code, 'write');
  assert.deepEqual(read(repo, sheet), current);
  storage.setItem = write;
  save(repo, sheet, draft);
  assert.equal(read(repo, sheet).students[0].subgroup, 2);
  assert.deepEqual(read(repo, { sheetId: 'other' }), other);
});

test('absent v2 keys use only demo defaults, legacy bytes survive reads and mutations', () => {
  const legacy = Object.fromEntries(['students', 'lessons', 'grades', 'form6_overrides', 'works_config_by_subject',
    'works_completion_by_subject', 'works_cross_marks'].map(name => ['vgtk_' + name, '  [] ']));
  legacy.vgtk_students = '[{"id":"s1","groupId":"foreign"}]';
  const env = memory(legacy);
  const repo = createScopedJournalRepository(env);
  const context = { sheetId: 'subj-kp-main' };
  const main = read(repo, context);
  assert.equal(main.students[0].groupId, 'group-1');
  assert.deepEqual(read(repo, { sheetId: 'subj-kp-sub2' }).lessons, main.lessons);
  assert.equal(read(repo, { sheetId: 'subj-db-main' }).journal.id, 'journal-2');
  assert.equal(read(repo, { sheetId: 'subj-web-main' }).journal.id, 'journal-3');
  assert.deepEqual(Object.fromEntries(env.values), legacy);
  save(repo, context, { ...grade, studentId: 's1', lessonId: 'l1' });
  for (const [key, raw] of Object.entries(legacy)) assert.equal(env.values.get(key), raw);
});

test('empty collections stay empty; dangling demo references and corrupt JSON block writes', () => {
  const env = memory();
  const repo = createScopedJournalRepository(env);
  for (const [name, key] of Object.entries(keys)) env.values.set(key,
    ['students','lessons','grades'].includes(name) ? '[]' : '{}');
  const empty = read(repo, { journalId: 'journal-1' });
  assert.deepEqual(empty.students, []);
  assert.deepEqual(empty.configs, {});
  env.values.delete(keys.grades);
  assert.equal(repo.read({ journalId: 'journal-1' }).error.key, 'grades');
  env.values.set(keys.grades, '{bad json');
  assert.equal(repo.mutate(empty, grade).error.code, 'invalid');
  assert.equal(env.values.get(keys.grades), '{bad json');
});

test('failed second write rolls back; stale dependencies reject a later mutation', () => {
  const { repo, storage, values } = fixture();
  const before = new Map(values);
  const set = storage.setItem;
  storage.setItem = (key, raw) => {
    if (key === keys.crossMarks) throw new Error('quota');
    set(key, raw);
  };
  const old = read(repo, sheet);
  assert.equal(repo.mutate(old, { type: 'setWork', studentId: 'c', workId: 'LAB_1', value: true,
    crossMark: { markedBySubgroup: 2 } }).error.code, 'write');
  assert.deepEqual(values, before);
  save(repo, sheet, { type: 'setSubgroups', updates: [{ id: 'c', subgroup: 2 }] });
  assert.equal(repo.mutate(old, grade).error.code, 'conflict');
  assert.equal(values.get(keys.grades), '[]');
});

test('subscriptions refresh after local writes and v2 storage events; unsubscribe detaches', () => {
  const { repo, eventTarget, values } = fixture();
  const counts = [];
  const stop = repo.subscribe(() => counts.push(read(repo, sheet).grades.length));
  const storageEvent = key => eventTarget.dispatchEvent(Object.assign(new Event('storage'), { key }));
  save(repo, sheet, grade);
  storageEvent('vgtk_grades');
  values.set(keys.grades, '[]');
  storageEvent(keys.grades);
  storageEvent(null);
  stop();
  storageEvent(keys.grades);
  assert.deepEqual(counts, [1, 0, 0]);
});

test('three cabinets share updates, with separate lessons, grades, work and reasons for ПО-32', () => {
  const env = memory();
  const teacher = createScopedJournalRepository(env);
  const curator = createScopedJournalRepository(env);
  const student = createScopedJournalRepository(env);
  const first = read(teacher, { sheetId: 'subj-kp-main' });
  const secondSheet = { sheetId: 'subj-kp-32-main' };
  const second = read(teacher, secondSheet);
  assert.equal(first.journal.subjectId, second.journal.subjectId);
  assert.notEqual(first.journal.id, second.journal.id);
  assert.equal(second.group.name, 'ПО-32');
  assert.equal(second.students.length, 2);
  assert.ok(second.grades.some(g => g.attendance === 'ABSENT'));
  assert.ok(second.grades.some(g => g.attendance === 'PRESENT'));
  const otherGroup = read(curator, { groupId: first.group.id });
  const otherStudent = read(student, { studentId: first.students[0].id });
  assert.equal(otherStudent.journals.length, 3);
  assert.equal(otherStudent.sheets.length, 4);
  const studentId = second.students[0].id;
  const lessonId = second.lessons[0].id;
  save(teacher, secondSheet, { type: 'setGrade', studentId, lessonId, hourIndex: 2,
    value: { grade: null, attendance: 'ABSENT' } });
  save(teacher, secondSheet, { type: 'setConfig', value: { initialized: true, labsCount: 1, practicalsCount: 0 } });
  save(teacher, secondSheet, { type: 'setWork', studentId, workId: 'LAB_1', value: true });
  const group = { groupId: second.group.id };
  save(curator, group, { type: 'setOverride', studentId, day: 23, value: { reason: 'З' } });
  for (const view of [read(curator, group), read(student, { studentId })]) {
    assert.deepEqual(view.journals.map(j => j.id), [second.journal.id]);
    assert.deepEqual(view.lessons, second.lessons);
    assert.ok(view.grades.some(g => g.studentId === studentId && g.lessonId === lessonId &&
      g.hourIndex === 2 && g.attendance === 'ABSENT'));
    assert.equal(view.configs[second.journal.id].labsCount, 1);
    assert.equal(view.completions[second.journal.id][studentId].LAB_1, true);
    assert.equal(view.overrides[studentId + '_23'].reason, 'З');
  }
  assert.ok(read(student, { studentId }).grades.every(g => g.studentId === studentId));
  save(curator, group, { type: 'setOverride', studentId, day: 23, value: null });
  assert.deepEqual(read(student, { studentId }).overrides, {});
  assert.deepEqual(read(curator, { groupId: first.group.id }), otherGroup);
  assert.deepEqual(read(student, { studentId: first.students[0].id }), otherStudent);
});

test('a 03B roster or lesson collection remains readable without appending ПО-32 on reopen', () => {
  const first = read(createScopedJournalRepository(memory()), { groupId: 'group-1' });
  for (const collection of ['students', 'lessons']) {
    const raw = JSON.stringify(first[collection]);
    const env = memory({ [keys[collection]]: raw });
    for (let i = 0; i < 2; i++) {
      const repo = createScopedJournalRepository(env);
      assert.deepEqual(read(repo, { groupId: first.group.id })[collection], first[collection]);
      const second = read(repo, { groupId: 'group-2' });
      assert.deepEqual(second[collection], []);
      assert.deepEqual(second.grades, []);
      assert.equal(repo.read({ studentId: 'missing' }).ok, false);
      assert.deepEqual(Object.fromEntries(env.values), { [keys[collection]]: raw });
    }
  }
});
