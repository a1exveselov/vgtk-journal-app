import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { readSchedule } from '../../data/scheduleRepository';
import { collegeTime, confirmedDay, scheduleIntent, scheduleRef } from '../../data/lessonCompletion';

const lessonTypes = { ЛЕК: 'Лекция', ПР: 'Практическое занятие', ЛАБ: 'Лабораторная работа', УРОК: 'Урок' };

function TimeRange({ start, end }) {
  return <div className="schedule-time">
    <time>{start}</time><span className="sr-only"> — </span><time>{end}</time>
  </div>;
}

function LessonCard({ lesson, linkToJournals, intent }) {
  const { slots, hours, subject, teacher, room, type, group, groupId, sheetId } = lesson;
  const pair = slots.length === 2;
  return <div className="schedule-card">
    <div className="schedule-card-meta">
      <span>{pair ? `Уроки ${slots[0].num}–${slots[1].num}` : `Урок ${slots[0].num}`} · {hours} акад. ч.</span>
      {room && <span>Ауд. {room}</span>}
    </div>
    <h3>{linkToJournals && sheetId
      ? <Link to={`/journal/${encodeURIComponent(sheetId)}`} state={intent && { lessonIntent: intent }}>
        {subject} <span aria-hidden="true">↗</span>
      </Link>
      : subject}</h3>
    <p>{[group || groupId, lessonTypes[type] || type].filter(Boolean).join(' · ')}</p>
    {teacher && <p>{teacher}</p>}
    {pair && <details className="schedule-detail">
      <summary>Состав пары<span className="sr-only"> · {subject}, уроки {slots[0].num}–{slots[1].num}</span></summary>
      <ol>{lesson.parts.map(part => <li key={part.start}>
        <span>{part.kind === 'break' ? 'Перемена' : 'Урок ' + part.num}</span>
        <span>{part.start}–{part.end}</span>
      </li>)}</ol>
    </details>}
  </div>;
}

function Interval({ item, demo }) {
  if (item.kind === 'lunch') return <div className="schedule-lunch"><strong>Обед</strong>
    <span>Слот {item.slots[0].num} · 45 мин{item.group && ' · ' + item.group}</span></div>;
  if (item.kind === 'window') {
    const breaks = item.parts.filter(part => part.kind === 'break');
    return <div className="schedule-gap"><strong>{demo ? 'Окно в демо-расписании' : 'Окно'}</strong>
      <span>Свободные слоты: {item.slots.map(s => s.num).join(', ')}</span>
      {breaks.length > 0 && <span>Внутренние перемены: {breaks.map(p => p.start + '–' + p.end).join(', ')}</span>}
    </div>;
  }
  return <span className="schedule-pause">{item.kind === 'break' ? 'Перемена · 10 мин' : 'Промежуток между занятиями'}</span>;
}

export default function ScheduleWidget({ linkToJournals = false, groupFilter = null, teacherSheets = null }) {
  const [day, setDay] = useState('today');
  const [now, setNow] = useState(Date.now);
  const schedule = readSchedule(day, groupFilter);
  const { timeline, summary, status, source, dateLabel, isoDate, warnings } = schedule;
  const demo = source === 'demo';
  const confirmed = teacherSheets && source === 'live' && confirmedDay(schedule, day, collegeTime(now));
  useEffect(() => {
    if (!teacherSheets || source !== 'live') return;
    const update = () => setNow(Date.now());
    document.addEventListener('visibilitychange', update);
    window.addEventListener('focus', update);
    return () => {
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('focus', update);
    };
  }, [teacherSheets, source]);
  return (
    <section className="schedule" aria-label={groupFilter ? `Расписание группы ${groupFilter}` : 'Расписание преподавателя'}>
      <header className="schedule-header">
        <div>
          <h2>Расписание{groupFilter && ` · ${groupFilter}`}</h2>
          <p className="schedule-source">{[demo ? 'Демо-расписание' : '', dateLabel || isoDate].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="schedule-switch" role="group" aria-label="День расписания">
          {[['today', 'Сегодня'], ['tomorrow', 'Завтра']].map(([key, label]) =>
            <button type="button" key={key} aria-pressed={day === key} onClick={() => {
              setDay(key);
              if (teacherSheets && source === 'live') setNow(Date.now());
            }}>{label}</button>)}
        </div>
      </header>
      <div aria-live="polite">
        {status === 'ready' && <dl className="schedule-summary">
          <div><dt>Занятий</dt><dd>{summary.count}</dd></div>
          <div><dt>Акад. часов</dt><dd>{summary.hours}</dd></div>
          <div><dt>Окончание занятий</dt><dd>{summary.end || '—'}</dd></div>
        </dl>}
        {status === 'empty' && <p className="schedule-message">{demo ? 'Демонстрационных записей на этот день нет.' : 'В источнике нет записей на этот день.'}</p>}
        {status === 'unavailable' && <p className="schedule-message">Расписание на этот день недоступно.</p>}
        {status === 'invalid' && <p className="schedule-message">Расписание содержит ошибки. Итоги не рассчитаны.</p>}
        {warnings.map((warning, i) => <p key={i} className="schedule-warning">{warning}</p>)}
      </div>
      {timeline.length > 0 && <ol className="schedule-timeline" key={JSON.stringify([day, groupFilter])}>
        {timeline.map(item => {
          const ref = confirmed && scheduleRef(schedule, item, teacherSheets);
          const intent = ref ? { kind: 'schedule', schedule: scheduleIntent(day, ref) } : undefined;
          return <li key={item.kind + '-' + (item.id ?? item.start)} className={'schedule-row schedule-row-' + item.kind}>
            <TimeRange start={item.start} end={item.end} />
            {item.kind === 'lesson' ? <LessonCard lesson={item} linkToJournals={linkToJournals} intent={intent} />
              : <Interval item={item} demo={demo} />}
          </li>;
        })}
      </ol>}
    </section>
  );
}
