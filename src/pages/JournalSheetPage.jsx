import { Link, useParams } from 'react-router-dom';
import { currentUser } from '../mocks/initialData';
import JournalTable from '../components/journal/JournalTable';

export default function JournalSheetPage() {
  const { sheetId } = useParams();
  const sheet = currentUser.teachingSubjects.find((entry) => entry.sheetId === sheetId);
  return (
    <div className="sheet-page">
      <Link to="/" className="back-link">← К расписанию</Link>
      {sheet ? (
        <JournalTable key={sheetId} sheetId={sheetId} subjectId={sheet.subjectId} subjectName={sheet.subjectName} isMainSheet={sheet.isMain} />
      ) : (
        <header className="sheet-heading"><h1>Журнал не найден</h1></header>
      )}
    </div>
  );
}
