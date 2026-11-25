import { useState } from 'react';
import { Link } from 'react-router-dom';
import { mockSchedule } from '../../mocks/initialData';

const lessonTypes = { ЛЕК: 'Лекция', ПР: 'Практическое занятие', ЛАБ: 'Лабораторная работа', УРОК: 'Урок' };

export default function ScheduleWidget({ linkToJournals = false, groupFilter = null }) {
  const [day, setDay] = useState('today');
  const { lessons, dateLabel } = mockSchedule[day];
  const visibleLessons = groupFilter ? lessons.filter((lesson) => lesson.group === groupFilter) : lessons;
  const hours = visibleLessons.reduce((sum, lesson) => sum + (lesson.isLunch ? 0 : lesson.hoursCount || 1), 0);

  return (
    <section className="schedule" aria-label={groupFilter ? `Расписание группы ${groupFilter}` : 'Расписание преподавателя'}>
      <header className="section-head">
        <h2 className="section-heading">Расписание{groupFilter && ` · ${groupFilter}`}</h2>
        <div className="day-switch" role="group" aria-label="День расписания">
          {[['today', 'Сегодня'], ['tomorrow', 'Завтра']].map(([key, label]) => (
            <button key={key} aria-pressed={day === key} onClick={() => setDay(key)}>{label}</button>
          ))}
        </div>
      </header>
      <div className="date-line" aria-live="polite"><strong>{dateLabel}</strong><span>{hours} акад. ч.</span></div>
      <table className="timetable">
        <caption className="sr-only">Занятия и перерывы · {dateLabel}</caption>
        <thead><tr><th scope="col">Время</th><th scope="col">Занятие</th><th scope="col">Ауд.</th></tr></thead>
        <tbody>
          {visibleLessons.map((lesson) => (
            <tr key={lesson.id} className={lesson.isLunch ? 'lunch-row' : undefined}>
              <td className="slot-times">
                {lesson.slots.map((slot) => (
                  <div key={slot.num}><span className="slot-number" aria-label={`${slot.num}-й час`}>{slot.num}</span>{slot.time.replaceAll('.', ':').replace(' - ', '–')}</div>
                ))}
              </td>
              <th scope="row">
                {!lesson.isLunch && <p className="lesson-meta">{lessonTypes[lesson.type] || lesson.type} · {lesson.group}</p>}
                {linkToJournals && !lesson.isLunch ? (
                  <Link className="lesson-link" to={`/journal/${lesson.sheetId}`}>{lesson.subject}<span aria-hidden="true"> ↗</span></Link>
                ) : <span className="lesson-name">{lesson.subject}</span>}
                {lesson.teacher && <p className="teacher-name">{lesson.teacher}</p>}
              </th>
              <td className="room">{lesson.room?.replace('/', ' / ') || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!visibleLessons.length && <p className="empty-schedule">На этот день занятий нет.</p>}
    </section>
  );
}
