import { useEffect } from 'react';
import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router-dom';
import { currentUser } from './mocks/initialData';
import { ThemeProvider } from './context/ThemeContext';
import ThemeToggle from './components/ui/ThemeToggle';
import TeacherDashboard from './pages/TeacherDashboard';
import JournalSheetPage from './pages/JournalSheetPage';
import StudentDashboard from './components/student/StudentDashboard';
import CuratorDashboard from './components/curator/CuratorDashboard';

function Header() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  const sections = [
    { to: '/', label: 'Преподаватель', active: pathname === '/' || pathname.startsWith('/journal/') },
    ...(currentUser.roles.includes('CURATOR') ? [{ to: '/curator', label: 'Куратор', active: pathname === '/curator' }] : []),
    { to: '/student', label: 'Учащийся', active: pathname === '/student' },
  ];

  return (
    <header className="masthead">
      <div className="masthead-inner">
        <Link to="/" className="college-brand">
          <img src="/favicon.svg" width="34" height="40" alt="" />
          <span>Электронный журнал<small>Витебский государственный технический колледж</small></span>
        </Link>
        <nav aria-label="Разделы журнала" className="role-nav">
          {sections.map(({ to, label, active }) => (
            <Link key={to} to={to} aria-current={active ? 'page' : undefined}>{label}</Link>
          ))}
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <a className="skip-link" href="#content">К содержанию</a>
        <Header />
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
