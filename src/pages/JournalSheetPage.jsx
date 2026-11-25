import { Link, useParams } from 'react-router-dom';
import { currentUser } from '../mocks/initialData';
import JournalTable from '../components/journal/JournalTable';

export default function JournalSheetPage() {
  const { sheetId } = useParams();
  const sheet = currentUser.teachingSubjects.find((entry) => entry.sheetId === sheetId) || {
    subjectId: 'subj-kp',
    subjectName: 'Конструирование программ и языки программирования',
    isMain: !sheetId.endsWith('sub2') && sheetId !== 'sheet-2',
  };
  return (
    <div className="sheet-page">
      <Link to="/" className="back-link">← К расписанию</Link>
      <JournalTable key={sheetId} sheetId={sheetId} subjectId={sheet.subjectId} subjectName={sheet.subjectName} isMainSheet={sheet.isMain} />
    </div>
  );
}
