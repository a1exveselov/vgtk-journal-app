import JournalDialog from '../ui/JournalDialog';
import { useRef, useState } from 'react';
import { X, AlertTriangle, Check } from 'lucide-react';

import { dateFields, isCalendarDate, lessonDate } from '../../data/period';
import { attendanceSignatures, completionLabel, hasTopic, isSubgroupLesson, lessonCompletion,
  lessonScopeSignature } from '../../data/lessonCompletion';
import { getLessonTimestamp } from './lessonDate';

function LessonCompletion({ lesson, sheet, onAction }) {
  const { status, confirmations } = lessonCompletion(lesson, sheet.sheetId);
  const hours = Array.from({ length: lesson.hours }, (_, i) => i + 1);
  const completed = status === 'completed';
  return <section className="lesson-completion" aria-labelledby="lesson-completion-title">
    <h3 id="lesson-completion-title">Завершение занятия</h3>
    <p role="status">{completionLabel[status]}</p>
    <fieldset>
      <legend>Посещаемость · {isSubgroupLesson(lesson) ? `${sheet.isMain ? 1 : 2}-я подгруппа` : 'вся группа'}</legend>
      <p>Проверьте посещаемость и отметьте отсутствующих в журнале.</p>
      {hours.map(hourIndex => {
        const checked = Boolean(confirmations[hourIndex]);
        return <label key={hourIndex} className="lesson-completion-hour">
          <input type="checkbox" checked={checked} onChange={event =>
            onAction({ type: 'confirmAttendance', hourIndex, value: event.target.checked },
              `${event.target.checked ? 'Подтвердить' : 'Снять подтверждение'} посещаемости за ${hourIndex}-й час`)} />
          <span>{hourIndex}-й академический час <strong>{checked ? 'Проверена' : 'Не проверена'}</strong></span>
        </label>;
      })}
    </fieldset>
    {!completed && !hasTopic(lesson) && <p>Чтобы завершить занятие, укажите и сохраните тему.</p>}
    <button className="lesson-action" type="button" onClick={() =>
      onAction({ type: completed ? 'reopenLesson' : 'completeLesson' },
        completed ? 'Вернуть в черновик' : 'Завершить занятие')}>
      {completed ? 'Вернуть в черновик' : 'Завершить занятие'}
    </button>
  </section>;
}

function ScheduleSelection({ opening, lessons, selection, onSelect, onBind }) {
  const candidates = new Set(opening.candidates.map(lesson => lesson.id));
  const bindable = new Set(opening.bindable.map(lesson => lesson.id));
  return <section className="lesson-completion lesson-match">
    <p>Выберите существующее занятие и подтвердите привязку к расписанию.</p>
    <ul>
      {lessons.map((lesson, index) => candidates.has(lesson.id) && <li key={lesson.id}>
        <label className="lesson-completion-hour">
          <input type="radio" name="schedule-lesson" value={lesson.id} disabled={!bindable.has(lesson.id)}
            checked={selection === lesson.id} onChange={() => onSelect(lesson.id)} />
          <span>№ {index + 1} · {lesson.isoDate || 'Дата требует уточнения'} · {lesson.type} · {lesson.hours} ч.
            {lesson.topic && ` · ${lesson.topic}`}{!bindable.has(lesson.id) && ' · Привязка недоступна'}</span>
        </label>
      </li>)}
    </ul>
    {!bindable.size && <p>Уточните дату, тип, часы или существующие привязки в журнале.</p>}
    <button type="button" className="lesson-action" disabled={!bindable.has(selection)} onClick={onBind}>
      Подтвердить привязку
    </button>
  </section>;
}

function attendanceChanged(base, snapshot, current) {
  if (!base.sheet || !snapshot.sheet || !current) return false;
  const before = base.lessons.find(lesson => lesson.id === current.id);
  if (!before || lessonScopeSignature(before) !== lessonScopeSignature(current)) return false;
  const previous = attendanceSignatures(before, base.sheet, base.students, base.grades);
  const latest = attendanceSignatures(current, snapshot.sheet, snapshot.students, snapshot.grades);
  return JSON.stringify(latest) !== JSON.stringify(previous);
}

export default function AddLessonModal({
  snapshot,
  onClose,
  onAdd,
  onUpdate,
  onDelete,
  onAction,
  scheduleOpening,
  readError,
  initialLesson = null,
  existingLessons = [],
  canModify = true
}) {
  const [base, setBase] = useState(snapshot);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const dismiss = () => { if (!pending.current) onClose(); };
  async function submit(operation, { stayOpen = false, label } = {}) {
    if (pending.current || error?.code === 'conflict') return;
    if (readError) return setError(readError);
    pending.current = true;
    setSaving(true);
    try {
      const result = await operation();
      if (result?.ok === true && !stayOpen) onClose();
      else if (result?.ok === true && result.snapshot) {
        setBase(result.snapshot);
        setError(null);
      } else setError({ ...(result?.error ?? { message: 'Сохранение не подтверждено.' }), label });
    } catch {
      setError({ message: 'Не удалось сохранить изменения. Черновик сохранён в форме.' });
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  const [mode, setMode] = useState(initialLesson ? 'view' : scheduleOpening?.kind === 'ambiguous' ? 'match' : 'create');
  const [newId] = useState(() => `l${globalThis.crypto?.randomUUID?.() ?? Date.now()}`);
  const [selection, setSelection] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [backdateWarning, setBackdateWarning] = useState(null);

  const schedule = scheduleOpening?.ref;
  const [formData, setFormData] = useState(() => {
    return {
      date: lessonDate(initialLesson) ?? schedule?.isoDate ?? '',
      type: initialLesson?.type || (schedule ? schedule.type ?? '' : 'ЛЕК'),
      hours: initialLesson?.hours || schedule?.slots.length || 2,
      topic: initialLesson?.topic || '',
      homework: initialLesson?.homework || '',
    };
  });

  const getLatestExistingLesson = () => {
    const relevantLessons = existingLessons.filter((l) =>
      mode === 'edit' && initialLesson ? l.id !== initialLesson.id : true
    );
    if (relevantLessons.length === 0) return null;

    return relevantLessons.reduce((latest, current) => {
      return getLessonTimestamp(current) >= getLessonTimestamp(latest) ? current : latest;
    }, relevantLessons[0]);
  };

  const commitSaveLesson = () => {
    const payload = {
      ...formData,
      ...dateFields(formData.date),
      hours: Number(formData.hours),
      isSubgroupOnly: formData.type === 'ПР' || formData.type === 'ЛАБ'
    };

    return submit(() => mode === 'edit' && initialLesson ? onUpdate(payload, base) : onAdd(payload, base, newId));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isCalendarDate(formData.date)) return setError({ message: 'Укажите существующую полную дату.' });
    if (!formData.type) return setError({ message: 'Укажите тип занятия.' });

    const latestLesson = getLatestExistingLesson();
    if (latestLesson) {
      const enteredTs = getLessonTimestamp(formData.date);
      const latestTs = getLessonTimestamp(latestLesson);

      if (enteredTs < latestTs && !backdateWarning) {
        setBackdateWarning({
          lastDateStr: lessonDate(latestLesson),
          lastType: latestLesson.type
        });
        return;
      }
    }

    commitSaveLesson();
  };

  const handleChange = (e) => {
    setBackdateWarning(null);
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const current = snapshot.lessons.find(l => l.id === initialLesson?.id);
  const viewed = current ?? initialLesson;
  const savedCompletion = current && snapshot.sheet && lessonCompletion(current, snapshot.sheet.sheetId);

  return (
    <JournalDialog titleId="lesson" onDismiss={dismiss}>
      {initialLesson && !lessonDate(initialLesson) && <p className="p-4">
        Дата требует уточнения. Исходная запись: {initialLesson.rawDate || initialLesson.date || initialLesson.day || 'без даты'}.
        Выберите «Редактировать» и укажите подтверждённую дату.
      </p>}
      <fieldset disabled={saving} className="min-w-0">
        {saving && <p role="status">Сохранение…</p>}
        {error && <div role="alert" className="p-4">
          <p>{error.message}</p>
          {error.label && <p>Действие: {error.label}.</p>}
          {error.code === 'conflict' && <>
            {current ? <p>Сейчас в журнале: {current.date}, {current.type}, {current.hours} ч. Тема: {current.topic || '—'}. ДЗ: {current.homework || '—'}.</p>
                : <p>{initialLesson ? 'Занятие больше не входит в этот журнал.' :
                  'Занятия журнала: ' + (existingLessons.map(l => l.date + ' ' + l.type).join(', ') || 'нет')}</p>}
            {savedCompletion && <p>{completionLabel[savedCompletion.status]}. Посещаемость подтверждена за часы:
              {' '}{Object.keys(savedCompletion.confirmations).join(', ') || 'ни за один'}.</p>}
            {attendanceChanged(base, snapshot, current) && <p>В журнале изменились состав учащихся или отметки «Н».</p>}
            <button type="button" className="lesson-action" disabled={Boolean(readError)}
              onClick={() => { setBase(snapshot); setError(null); }}>
              Продолжить с текущей версией журнала
            </button>
          </>}
        </div>}
        <div className="flex justify-between items-center p-5 border-b border-emerald-900 bg-[#23483c] text-white">
          <div className="flex items-center gap-3">
            <div>
              <h2 id="lesson" className="text-base font-bold text-white tracking-wide">
                {mode === 'create' && 'Новое занятие'}
                {mode === 'match' && 'Сопоставление с расписанием'}
                {mode === 'view' && `Занятие от ${initialLesson?.date}`}
                {mode === 'edit' && `Редактирование занятия (${initialLesson?.date})`}
              </h2>
              <p className="text-xs text-emerald-200/80 mt-0.5">
                {mode === 'create' && 'Добавление колонки в журнал предмета'}
                {mode === 'view' && (canModify ? 'Информация о теме, часах и ДЗ' : 'Занятие создано главным преподавателем')}
                {mode === 'edit' && 'Изменение параметров проведённого занятия'}
              </p>
            </div>
          </div>

          <button
            onClick={dismiss}
            aria-label="Закрыть"
            className="text-emerald-200/70 hover:text-amber-300 hover:bg-white/10 transition-colors rounded-sm p-1.5 cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {schedule && <p className="lesson-schedule-reference">
          По расписанию · {schedule.isoDate} · {schedule.slots[0].start}–{schedule.slots.at(-1).end} · {schedule.slots.length} ак. ч.
        </p>}
        {mode === 'match' ? (
          <ScheduleSelection opening={scheduleOpening} lessons={existingLessons} selection={selection} onSelect={setSelection}
            onBind={() => submit(() => onAction(base, { type: 'bindSchedule', lessonId: selection,
              scheduleIntent: scheduleOpening.intent }), { label: 'Подтвердить привязку' })} />
        ) : mode === 'view' && initialLesson ? (
          <div className="p-5 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-900 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 rounded-lg text-xs font-extrabold">
                Тип: {viewed.type}
              </span>
              <span className="px-2.5 py-1 bg-[#EFECE6] dark:bg-[#181B20] text-stone-800 dark:text-zinc-200 border border-[#DED8CE] dark:border-[#323844] rounded-lg text-xs font-bold flex items-center gap-1.5">
                {viewed.hours === 2 ? 'Пара (2 ак. часа)' : 'Урок (1 ак. час)'}
              </span>
              {isSubgroupLesson(viewed) && (
                <span className="px-2.5 py-1 bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30 rounded-lg text-xs font-bold">
                  Деление по подгруппам
                </span>
              )}
            </div>

            <div className="p-4 rounded-sm bg-[#F3EFE8] dark:bg-[#181B20] border border-[#E2DCD3] dark:border-[#323844] space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-stone-600 dark:text-zinc-400 uppercase">
                <span>Тема занятия</span>
              </div>
              {viewed.topic ? (
                <p className="text-sm font-bold text-stone-900 dark:text-zinc-100 leading-relaxed whitespace-pre-wrap">
                  {viewed.topic}
                </p>
              ) : (
                <p className="text-sm text-stone-400 dark:text-zinc-500 italic">Тема не указана</p>
              )}
            </div>

            <div className="p-4 rounded-sm bg-[#F6EBD8]/70 dark:bg-[#1D1B16] border border-amber-300/80 dark:border-amber-500/30 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-950 dark:text-amber-300 uppercase">
                <span>Домашнее задание</span>
              </div>
              {viewed.homework ? (
                <p className="text-sm font-semibold text-stone-900 dark:text-zinc-100 leading-relaxed whitespace-pre-wrap">
                  {viewed.homework}
                </p>
              ) : (
                <p className="text-sm text-stone-400 dark:text-zinc-500 italic">Домашнее задание не задано</p>
              )}
            </div>

            {onAction && current && snapshot.sheet && <LessonCompletion lesson={current} sheet={snapshot.sheet}
              onAction={(command, label) => submit(() => onAction(base, { ...command, lessonId: current.id }),
                { stayOpen: true, label })} />}

            {confirmDelete ? (
              <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-500/40 rounded-sm space-y-3">
                <div className="flex items-start gap-2.5 text-rose-950 dark:text-rose-200 text-xs leading-relaxed">
                  <AlertTriangle size={17} className="shrink-0 mt-0.5 text-rose-700 dark:text-rose-400" />
                  <span>
                    Удалить колонку занятия за <b>{initialLesson.date}</b>? Все выставленные в эту дату оценки и «Н» также будут удалены.
                  </span>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-3.5 py-1.5 text-xs font-bold text-stone-800 dark:text-zinc-200 bg-[#EFECE6] dark:bg-[#2A2F3A] border border-[#DED8CE] dark:border-[#3A404D] rounded-sm cursor-pointer"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      submit(() => onDelete(initialLesson.id, base));
                    }}
                    className="px-3.5 py-1.5 text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 rounded-sm cursor-pointer"
                  >
                    Да, удалить колонку
                  </button>
                </div>
              </div>
            ) : (
              <div className="pt-4 border-t border-[#E2DCD3] dark:border-[#323844] flex items-center justify-between gap-2">
                {canModify ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-rose-800 dark:text-rose-300 bg-rose-50/80 dark:bg-rose-500/15 hover:bg-rose-100 dark:hover:bg-rose-500/25 border border-rose-200 dark:border-rose-500/30 rounded-sm transition-colors cursor-pointer"
                  >
                    <span>Удалить</span>
                  </button>
                ) : (
                  <span className="text-[11px] text-stone-500 dark:text-zinc-400">Редактирование доступно главному преподавателю</span>
                )}

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={dismiss}
                    className="px-4 py-2 text-xs font-bold text-stone-800 dark:text-zinc-200 bg-[#EFECE6] dark:bg-[#2A2F3A] hover:bg-[#E2DCD3] dark:hover:bg-[#323846] border border-[#DED8CE] dark:border-[#3A404D] rounded-sm transition-colors cursor-pointer"
                  >
                    Закрыть
                  </button>
                  {canModify && (
                    <button
                      type="button"
                      onClick={() => setMode('edit')}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#244b3c] hover:bg-emerald-950 border border-amber-400/30 rounded-sm shadow-xs transition-colors cursor-pointer"
                    >
                      <span>Редактировать</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-zinc-300 uppercase tracking-wide mb-2">
                Формат занятия (количество часов)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={Boolean(schedule)}
                  onClick={() => setFormData({ ...formData, hours: 2 })}
                  className={`p-3 rounded-sm border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                    Number(formData.hours) === 2
                      ? 'border-emerald-700 dark:border-emerald-500 bg-emerald-50/80 dark:bg-emerald-500/15 text-stone-900 dark:text-zinc-100 ring-2 ring-emerald-700/20'
                      : 'border-[#DED8CE] dark:border-[#323844] bg-[#F3EFE8] dark:bg-[#181B20] hover:bg-[#EFECE6] dark:hover:bg-[#1E2229] text-stone-700 dark:text-zinc-300'
                  }`}
                >
                  <div>
                    <div className="text-sm font-bold">Пара (2 часа)</div>
                    <div className="text-[11px] text-stone-500 dark:text-zinc-400">2 клетки на дату</div>
                  </div>
                </button>

                <button
                  type="button"
                  disabled={Boolean(schedule)}
                  onClick={() => setFormData({ ...formData, hours: 1 })}
                  className={`p-3 rounded-sm border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                    Number(formData.hours) === 1
                      ? 'border-emerald-700 dark:border-emerald-500 bg-emerald-50/80 dark:bg-emerald-500/15 text-stone-900 dark:text-zinc-100 ring-2 ring-emerald-700/20'
                      : 'border-[#DED8CE] dark:border-[#323844] bg-[#F3EFE8] dark:bg-[#181B20] hover:bg-[#EFECE6] dark:hover:bg-[#1E2229] text-stone-700 dark:text-zinc-300'
                  }`}
                >
                  <div>
                    <div className="text-sm font-bold">Урок (1 час)</div>
                    <div className="text-[11px] text-stone-500 dark:text-zinc-400">1 клетка на дату</div>
                  </div>
                </button>
              </div>
            </div>
            {mode === 'edit' && current?.hours === 2 && Number(formData.hours) === 1 &&
              <p className="lesson-form-warning">При сохранении отметки за второй час будут удалены.</p>}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="lesson-date" className="block text-xs font-bold text-stone-700 dark:text-zinc-300 uppercase tracking-wide mb-1.5">Дата</label>
                <input
                  type="date"
                  id="lesson-date" name="date"
                  value={formData.date}
                  onChange={handleChange}
                  readOnly={Boolean(schedule)}
                  className="w-full px-3 py-2 bg-[#F3EFE8] dark:bg-[#181B20] border border-[#DED8CE] dark:border-[#323844] rounded-sm focus:ring-2 focus:ring-emerald-700 outline-none transition-all text-sm font-medium text-stone-900 dark:text-zinc-100"
                  required
                />
              </div>
              <div>
                <label htmlFor="lesson-type" className="block text-xs font-bold text-stone-700 dark:text-zinc-300 uppercase tracking-wide mb-1.5">Тип занятия</label>
                <select
                  id="lesson-type" name="type"
                  value={formData.type}
                  onChange={handleChange}
                  disabled={Boolean(schedule?.type)}
                  required
                  className="w-full px-3 py-2 bg-[#F3EFE8] dark:bg-[#181B20] border border-[#DED8CE] dark:border-[#323844] rounded-sm focus:ring-2 focus:ring-emerald-700 outline-none transition-all cursor-pointer text-sm font-medium text-stone-900 dark:text-zinc-100"
                >
                  {!formData.type && <option value="" disabled>Выберите тип</option>}
                  <option value="ЛЕК">Лекция (ЛЕК)</option>
                  <option value="ПР">Практика (ПР)</option>
                  <option value="ЛАБ">Лабораторная (ЛАБ)</option>
                  <option value="УРОК">Урок (1 ч.)</option>
                  <option value="КР">Контрольная (КР)</option>
                  <option value="ОК">ОК</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="lesson-topic" className="block text-xs font-bold text-stone-700 dark:text-zinc-300 uppercase tracking-wide mb-1.5">Тема занятия</label>
              <textarea
                rows={2}
                id="lesson-topic" name="topic"
                value={formData.topic}
                onChange={handleChange}
                placeholder="Например: Паттерны проектирования в ООП"
                className="w-full px-3 py-2 bg-[#F3EFE8] dark:bg-[#181B20] border border-[#DED8CE] dark:border-[#323844] rounded-sm focus:ring-2 focus:ring-emerald-700 outline-none transition-all text-sm text-stone-900 dark:text-zinc-100 placeholder:text-stone-400 dark:placeholder:text-zinc-500 resize-none"
              />
            </div>

            <div>
              <label htmlFor="lesson-homework" className="block text-xs font-bold text-stone-700 dark:text-zinc-300 uppercase tracking-wide mb-1.5">Домашнее задание</label>
              <textarea
                rows={2}
                id="lesson-homework" name="homework"
                value={formData.homework}
                onChange={handleChange}
                placeholder="Например: Конспект лекции, подготовить отчёт"
                className="w-full px-3 py-2 bg-[#F3EFE8] dark:bg-[#181B20] border border-[#DED8CE] dark:border-[#323844] rounded-sm focus:ring-2 focus:ring-emerald-700 outline-none transition-all text-sm text-stone-900 dark:text-zinc-100 placeholder:text-stone-400 dark:placeholder:text-zinc-500 resize-none"
              />
            </div>

            {backdateWarning && (
              <div className="p-4 bg-[#F6EBD8] dark:bg-amber-950/40 border border-amber-400 dark:border-amber-500/40 rounded-sm space-y-3">
                <div className="flex items-start gap-2.5 text-stone-900 dark:text-amber-100 text-xs leading-relaxed">
                  <div>
                    <span className="font-bold block text-stone-950 dark:text-amber-200 mb-0.5">
                      Нарушение хронологического порядка дат
                    </span>
                    Введенная дата занятия раньше предыдущего созданного занятия в журнале (<b>{backdateWarning.lastDateStr} • {backdateWarning.lastType}</b>). Вы уверены, что хотите добавить занятие задним числом?
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setBackdateWarning(null)}
                    className="px-3.5 py-1.5 text-xs font-bold text-stone-800 dark:text-zinc-200 bg-[#FAF8F5] dark:bg-[#2A2F3A] border border-[#DED8CE] dark:border-[#3A404D] rounded-sm cursor-pointer"
                  >
                    Отменить сохранение
                  </button>
                  <button
                    type="button"
                    onClick={commitSaveLesson}
                    className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#244b3c] hover:bg-emerald-950 rounded-sm shadow-2xs cursor-pointer"
                  >
                    Да, добавить задним числом
                  </button>
                </div>
              </div>
            )}

            {!backdateWarning && (
              <div className="pt-4 flex justify-end gap-2.5 border-t border-[#E2DCD3] dark:border-[#323844] mt-4">
                <button
                  type="button"
                  onClick={() => {
                    if (mode === 'edit' && initialLesson) {
                      setMode('view');
                    } else {
                      onClose();
                    }
                  }}
                  className="px-4 py-2 text-xs font-bold text-stone-800 dark:text-zinc-200 bg-[#EFECE6] dark:bg-[#2A2F3A] hover:bg-[#E2DCD3] dark:hover:bg-[#323846] border border-[#DED8CE] dark:border-[#3A404D] rounded-sm transition-colors cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#244b3c] hover:bg-emerald-950 border border-amber-400/30 rounded-sm shadow-sm transition-colors cursor-pointer"
                >
                  <Check size={15} />
                  <span>
                    {mode === 'edit'
                      ? 'Сохранить изменения'
                      : `Создать (${Number(formData.hours) === 2 ? '2 клетки' : '1 клетку'})`}
                  </span>
                </button>
              </div>
            )}
          </form>
        )}
      </fieldset>
    </JournalDialog>
  );
}
