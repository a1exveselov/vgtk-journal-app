import JournalIndex from './JournalIndex';
import ScheduleWidget from './ScheduleWidget';

export default function TeacherWorkspace({ teacher }) {
  return (
    <div className="teacher-workspace">
      <header className="teacher-workspace-heading">
        <h1>Кабинет преподавателя</h1>
        <p>{teacher.fullName}</p>
      </header>
      <div className="teacher-workspace-columns">
        <JournalIndex userId={teacher.id} sheets={teacher.teachingSubjects} />
        <ScheduleWidget linkToJournals />
      </div>
    </div>
  );
}
