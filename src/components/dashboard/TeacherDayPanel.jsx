import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { createScopedJournalRepository } from '../../data/journalRepository';
import { readSchedule } from '../../data/scheduleRepository';
import { completionLabel, dayState, matchOccurrence, scheduleIntent, scheduleRef,
  unfinishedLessons } from '../../data/lessonCompletion';

const segmentLabels = {
  before: 'До первого известного занятия', lesson: 'Сейчас идёт урок', internalBreak: 'Перемена внутри пары',
  break: 'Перемена между занятиями', lunch: 'Обед', window: 'Окно', gap: 'Промежуток по расписанию не подтверждён',
  after: 'Учебные занятия закончились', lastKnown: 'Последнее известное занятие завершено',
  empty: 'Занятий по подтверждённому расписанию нет', unavailable: 'Актуальное расписание недоступно',
  demo: 'Демонстрационное расписание. Текущее занятие недоступно'
};

function openDay(sheets) {
  const repository = createScopedJournalRepository();
  function read() {
    const results = [...new Set(sheets.map(sheet => sheet.sheetId))].map(sheetId => repository.read({ sheetId }));
    return { snapshots: results.filter(result => result.ok).map(result => result.snapshot),
      errors: results.filter(result => !result.ok).map(result => result.error.message) };
  }
  let view = read();
  return {
    getSnapshot: () => view,
    subscribe(listener) {
      function refresh() {
        view = read();
        listener();
      }
      const unsubscribe = repository.subscribe(refresh);
      refresh();
      return unsubscribe;
    }
  };
}

function SheetLink({ sheetId, intent, children }) {
  return <Link className="teacher-day-link" to={`/journal/${encodeURIComponent(sheetId)}`}
    state={{ lessonIntent: intent }}>{children}</Link>;
}

function Countdown({ target }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const update = () => setNow(Date.now());
    const timer = window.setInterval(update, 1000);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  const seconds = Math.max(0, target - Math.floor(now / 1000));
  const display = [Math.floor(seconds / 60), seconds % 60].map(n => String(n).padStart(2, '0')).join(':');
  return <p className="teacher-day-countdown">До смены сегмента <time>{display}</time></p>;
}

function EventDetails({ segment, reference, day, snapshots }) {
  const { event } = segment;
  if (!event) {
    return <p className="teacher-day-meta">{segment.start}–{segment.end}</p>;
  }
  if (!reference) return <p className="teacher-day-meta">Учебное назначение требует уточнения.</p>;
  const snapshot = snapshots.find(item => item.sheet.sheetId === reference.sheetId);
  const match = snapshot && matchOccurrence(reference, snapshot.lessons);
  return <>
    <p className="teacher-day-subject">{event.subject || snapshot?.sheet.subjectName}</p>
    <p className="teacher-day-meta">{[event.group || snapshot?.group.name || reference.groupId, event.room && `ауд. ${event.room}`,
      segment.hour && `${segment.hour}-й академический час · урок ${segment.num}`, `${segment.start}–${segment.end}`]
      .filter(Boolean).join(' · ')}</p>
    {match && <SheetLink sheetId={reference.sheetId} intent={{ kind: 'schedule', schedule: scheduleIntent(day, reference) }}>
      {{ linked: 'Открыть журнал', missing: 'Заполнить занятие', ambiguous: 'Требуется сопоставление' }[match.kind]}
    </SheetLink>}
  </>;
}

const timingLabels = { unknownTime: 'Время занятия неизвестно', undated: 'Дата требует уточнения' };
function SavedLessons({ rows }) {
  return <ul className="teacher-day-list">{rows.map(({ sheet, lesson, timing }) =>
    <li key={JSON.stringify([sheet.sheetId, lesson.id])}>
      <SheetLink sheetId={sheet.sheetId} intent={{ kind: 'lesson', lessonId: lesson.id }}>
        {lesson.topic || sheet.subjectName}
      </SheetLink>
      <span>{[sheet.groupName, sheet.isMain ? 'Основной лист' : '2-я подгруппа',
        lesson.isoDate, timingLabels[timing]].filter(Boolean).join(' · ')}</span>
    </li>)}</ul>;
}

export default function TeacherDayPanel({ sheets }) {
  const store = useMemo(() => openDay(sheets), [sheets]);
  const view = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [now, setNow] = useState(Date.now);
  const today = readSchedule('today');
  const tomorrow = readSchedule('tomorrow');
  const state = dayState(today, tomorrow, now);
  const { kind, current, next, complete, teachingEnded, nextChange, countdown, time } = state;
  const currentRef = current?.event && scheduleRef(today, current.event, sheets);
  const nextRef = next && scheduleRef(next.day === 'today' ? today : tomorrow, next.event, sheets);
  const deadline = today.source === 'live' || tomorrow.source === 'live'
    ? Math.floor(now / 1000) + Math.min(nextChange ?? Infinity, 86400 - (time?.seconds ?? 0)) : null;
  useEffect(() => {
    const update = () => setNow(Date.now());
    const timer = deadline === null ? null : window.setTimeout(update, Math.max(0, deadline * 1000 - Date.now()));
    document.addEventListener('visibilitychange', update);
    window.addEventListener('focus', update);
    return () => {
      if (timer !== null) window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('focus', update);
    };
  }, [deadline]);

  const { snapshots, errors } = view;
  const { saved, scheduled, uncertain } = unfinishedLessons(snapshots, today, now, sheets);
  const drafts = saved.filter(row => row.status === 'draft' && row.timing === 'past');
  const uncertainDrafts = saved.filter(row => row.status === 'draft' && row.timing !== 'past');
  const unknown = saved.filter(row => row.status === 'unknown');
  const missing = scheduled.filter(row => row.kind === 'missing');
  const ambiguous = scheduled.filter(row => row.kind === 'ambiguous');
  const target = countdown && (kind === 'before' ? nextRef : !current?.event || currentRef)
    ? Math.floor(now / 1000) + countdown : null;
  const label = current?.event && !currentRef ? 'Текущее занятие требует уточнения' : segmentLabels[kind];
  return <section className="teacher-day" aria-labelledby="teacher-day-title">
    <h2 id="teacher-day-title">Рабочий день</h2>
    <div className="teacher-day-columns">
      <div>
        <h3>Сейчас</h3>
        <p role="status">{label}</p>
        {current && <EventDetails segment={current} reference={currentRef} day="today" snapshots={snapshots} />}
        {kind === 'lunch' && teachingEnded && <p className="teacher-day-meta">{segmentLabels[complete ? 'after' : 'lastKnown']}</p>}
        {target && <Countdown key={target} target={target} />}
      </div>
      <div>
        <h3>Следующий урок</h3>
        {next ? <>
          <p className="teacher-day-meta">{next.day === 'today' ? 'Сегодня' : 'Завтра'}</p>
          <EventDetails segment={next} reference={nextRef} day={next.day} snapshots={snapshots} />
        </> : <p>{kind === 'demo' || kind === 'unavailable' ? 'Нет актуальных данных' : 'Следующий урок не подтверждён'}</p>}
      </div>
    </div>
    <section className="teacher-day-unfinished" aria-labelledby="teacher-unfinished-title">
      <h3 id="teacher-unfinished-title">Незавершённые занятия</h3>
      {(errors.length > 0 || uncertain) && <p className="teacher-day-warning" role="status">
        {errors.length > 0 && (snapshots.length ? 'Доступна только часть листов журнала. ' : 'Журналы недоступны. ')}
        {errors[0]} {uncertain && 'Для части занятий по расписанию требуется уточнить назначение или доступность листа.'}
      </p>}
      {!drafts.length && !uncertainDrafts.length && !missing.length && !errors.length && !uncertain &&
        <p className="teacher-day-meta">Сохранённых черновиков и подтверждённых пропусков нет.</p>}
      {drafts.length > 0 && <details><summary>Сохранённые черновики</summary><SavedLessons rows={drafts} /></details>}
      {uncertainDrafts.length > 0 && <details><summary>Черновики с неуточнённым временем или датой</summary>
        <SavedLessons rows={uncertainDrafts} /></details>}
      {unknown.length > 0 && <details><summary>{completionLabel.unknown}</summary><SavedLessons rows={unknown} /></details>}
      {[[missing, 'Журнал не заполнен'], [ambiguous, 'Требуется сопоставление']].map(([rows, heading]) =>
        rows.length > 0 && <details key={heading}><summary>{heading}</summary><ul className="teacher-day-list">
          {rows.map(({ event, ref }) => {
            const intent = scheduleIntent('today', ref);
            return <li key={intent.key}>
              <SheetLink sheetId={ref.sheetId} intent={{ kind: 'schedule', schedule: intent }}>{event.subject}</SheetLink>
              <span>{event.group || ref.groupId} · {event.start}–{event.end}</span>
            </li>;
          })}
        </ul></details>)}
    </section>
  </section>;
}
