import React from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Calendar, Users, ArrowLeft, GraduationCap } from 'lucide-react';
import { currentUser } from './mocks/initialData';
import JournalTable from './components/journal/JournalTable';
import ScheduleWidget from './components/dashboard/ScheduleWidget';
import CuratorDashboard from './components/curator/CuratorDashboard';
import StudentDashboard from './components/student/StudentDashboard';

// Страница дашборда преподавателя
const TeacherDashboard = () => {
  const navigate = useNavigate();

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-2 text-gray-900">Расписание и журналы преподавателя</h1>
        <p className="text-gray-600">Выберите пару из расписания на сегодня или перейдите к списку журналов.</p>
      </div>
      
      <ScheduleWidget 
        onSelectJournal={(sheetId) => navigate(`/journal/${sheetId}`)} 
      />

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">Все журналы преподавателя</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {currentUser?.teachingSubjects?.map(subj => (
            <div 
              key={subj.id}
              onClick={() => navigate(`/journal/${subj.sheetId}`)}
              className="p-5 border border-gray-200 rounded-xl hover:border-blue-500 hover:shadow-md transition cursor-pointer bg-gray-50/50 flex justify-between items-center group"
            >
              <div>
                <h4 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{subj.subjectName}</h4>
                <p className="text-sm text-gray-500 mt-1">Группа: <span className="font-medium text-gray-700">{subj.groupName}</span></p>
                <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-full font-medium ${subj.isMain ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'}`}>
                  {subj.isMain ? "Главный преподаватель (Основной лист)" : "2-я подгруппа (Лаб/Практ)"}
                </span>
              </div>
              <span className="text-blue-600 font-medium text-sm group-hover:translate-x-1 transition-transform">Открыть →</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Страница листа журнала
// Страница листа журнала в src/App.jsx
const JournalSheetPage = () => {
  const { sheetId } = useParams();

  // Находим метаданные выбранного журнала из списка предметов преподавателя
  const subjectMeta = currentUser?.teachingSubjects?.find(s => s.sheetId === sheetId) || {
    subjectId: 'subj-kp',
    subjectName: 'Конструирование программ и языки программирования',
    isMain: !sheetId?.endsWith('sub2') && sheetId !== 'sheet-2'
  };

  return (
    <div className="p-4">
      <div className="mb-2 px-6 pt-4">
        <Link to="/" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors">
          <ArrowLeft size={16} />
          <span>Назад к списку журналов</span>
        </Link>
      </div>
      <JournalTable
        sheetId={sheetId}
        subjectId={subjectMeta.subjectId}
        subjectName={subjectMeta.subjectName}
        isMainSheet={subjectMeta.isMain}
      />
    </div>
  );
};

// Кураторский дашборд
const CuratorPage = () => <CuratorDashboard />;

// Боковое меню
const Sidebar = () => {
  const location = useLocation();

  if (!currentUser) {
    return <aside className="w-64 bg-gray-900 text-white p-5">Загрузка профиля...</aside>;
  }

  const isActive = (path) => location.pathname === path 
    ? "bg-blue-600 text-white" 
    : "text-gray-300 hover:bg-gray-800 hover:text-white";

  return (
    <aside className="w-64 bg-gray-900 text-white flex flex-col min-h-screen shadow-xl shrink-0">
      <div className="p-5 border-b border-gray-800">
        <h2 className="text-lg font-bold text-blue-400">Электронный Журнал</h2>
        <p className="text-xs text-gray-400 mt-1">ВГТК • {currentUser.fullName}</p>
      </div>

      <nav className="flex-1 p-4 space-y-1.5">
        <Link to="/" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive('/')}`}>
          <Calendar size={20} />
          <span>Расписание и Журналы</span>
        </Link>

        {currentUser.roles?.includes('CURATOR') && (
          <Link to="/curator" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive('/curator')}`}>
            <Users size={20} />
            <span>Мои группы (Куратор)</span>
          </Link>
        )}

        <Link to="/student" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive('/student')}`}>
          <GraduationCap size={20} />
          <span>Кабинет учащегося</span>
        </Link>
      </nav>

      <div className="p-4 border-t border-gray-800 text-xs text-gray-500">
        Прототип ВГТК • 2026
      </div>
    </aside>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-gray-100 font-sans">
        <Sidebar />
        <main className="flex-1 overflow-x-auto">
          <Routes>
            <Route path="/" element={<TeacherDashboard />} />
            <Route path="/journal/:sheetId" element={<JournalSheetPage />} />
            <Route path="/curator" element={<CuratorPage />} />
            <Route path="/student" element={<StudentDashboard />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}