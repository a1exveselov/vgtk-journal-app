import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { currentUser } from './mocks/initialData';
import { ThemeProvider } from './context/ThemeContext';
import AppHeader from './components/ui/AppHeader';
import TeacherDashboard from './pages/TeacherDashboard';
import JournalSheetPage from './pages/JournalSheetPage';
import StudentDashboard from './components/student/StudentDashboard';
import CuratorDashboard from './components/curator/CuratorDashboard';

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <a className="skip-link" href="#content">К содержанию</a>
        <AppHeader roles={currentUser.roles} />
        <main className="workspace" id="content" tabIndex={-1}>
          <Routes>
            <Route path="/" element={<TeacherDashboard />} />
            <Route path="/journal/:sheetId" element={<JournalSheetPage />} />
            <Route path="/curator" element={<CuratorDashboard />} />
            <Route path="/student" element={<StudentDashboard />} />
          </Routes>
        </main>
      </BrowserRouter>
    </ThemeProvider>
  );
}
