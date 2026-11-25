import { Link } from 'react-router-dom';
import ScheduleWidget from '../components/dashboard/ScheduleWidget';
import { currentUser } from '../mocks/initialData';

function JournalIndex({ sheets }) {
  const subjects = new Map();
  for (const sheet of sheets) {
    if (!subjects.has(sheet.subjectId)) subjects.set(sheet.subjectId, []);
    subjects.get(sheet.subjectId).push(sheet);
  }
  return (
    <aside className="journal-index" aria-labelledby="journal-index-title">
      <h2 className="section-heading" id="journal-index-title">Мои журналы</h2>
      {Array.from(subjects, ([id, entries]) => (
        <section key={id} className="index-entry">
          <h3>{entries[0].subjectName}</h3>
          <ul>
            {entries.map((sheet) => (
              <li key={sheet.sheetId}>
                <Link to={`/journal/${sheet.sheetId}`} aria-label={`${sheet.subjectName}, ${sheet.groupName}, ${sheet.isMain ? 'основной лист' : '2-я подгруппа'}`}>
                  <span>{sheet.groupName} <span className="index-divider">/</span> {sheet.isMain ? 'Основной лист' : '2-я подгруппа'}</span>
                  <span aria-hidden="true">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </aside>
  );
}

export default function TeacherDashboard() {
  return (
    <>
      <header className="journal-cover">
        <div className="cover-caption">
          <p className="section-kicker">Кабинет преподавателя</p>
          <h1>Расписание и журналы</h1>
          <p className="cover-name">{currentUser.fullName}</p>
        </div>
        <div className="register-drawing" aria-hidden="true">
          <div className="book-block"><i className="book-page left-page" /><i className="book-page right-page" /><i className="ribbon" /></div>
        </div>
      </header>
      <div className="teacher-columns">
        <ScheduleWidget linkToJournals />
        <JournalIndex sheets={currentUser.teachingSubjects} />
      </div>
    </>
  );
}
