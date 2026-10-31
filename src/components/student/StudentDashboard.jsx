import React, { useState } from 'react';
import {
  GraduationCap,
  Award,
  BookOpen,
  Clock,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Home,
  User,
  CheckSquare,
  FileText
} from 'lucide-react';
import { mockStudents, mockLessons, mockGrades } from '../../mocks/initialData';
import ScheduleWidget from '../dashboard/ScheduleWidget';
import { getLessonTimestamp } from '../journal/AddLessonModal';

// Справочник реальных дисциплин группы ПО-31, привязанный к subjectId
const SUBJECTS_CATALOG = [
  {
    subjectId: 'subj-kp',
    name: 'Конструирование программ и языки программирования',
    teacher: '1 п/г: Иванов И. И. / 2 п/г: Петров П. П.'
  },
  {
    subjectId: 'subj-db',
    name: 'Базы данных',
    teacher: 'Сидорова А. В.'
  },
  {
    subjectId: 'subj-web',
    name: 'Технология разработки веб-ресурсов',
    teacher: '1 п/г: Иванов И. И. / 2 п/г: Козлов Д. С.'
  }
];

const DEFAULT_SUBJECT_CONFIGS = {
  'subj-kp': { initialized: true, labsCount: 4, practicalsCount: 3 },
  'subj-db': { initialized: true, labsCount: 5, practicalsCount: 2 },
  'subj-web': { initialized: true, labsCount: 6, practicalsCount: 0 }
};

const ABSENCE_TYPES = [
  { code: 'Б', label: 'Больничный (Б)', color: 'bg-sky-100 text-sky-800 border-sky-300', isExcused: true },
  { code: 'О', label: 'Объяснительная (О)', color: 'bg-indigo-100 text-indigo-800 border-indigo-300', isExcused: true },
  { code: 'З', label: 'Заявление (З)', color: 'bg-violet-100 text-violet-800 border-violet-300', isExcused: true },
  { code: 'К', label: 'Мероприятия (К)', color: 'bg-emerald-100 text-emerald-800 border-emerald-300', isExcused: true },
  { code: 'Н/У', label: 'Неуважительная (Н/У)', color: 'bg-red-100 text-red-800 border-red-300', isExcused: false },
  { code: 'Сп', label: 'Свободное посещение (Сп)', color: 'bg-amber-100 text-amber-800 border-amber-300', isFree: true },
];

export default function StudentDashboard() {
  // 1. Загружаем список учащихся
  const [students] = useState(() => {
    try {
      const saved = localStorage.getItem('vgtk_students');
      return saved ? JSON.parse(saved) : mockStudents;
    } catch {
      return mockStudents;
    }
  });

  // 2. Загружаем занятия всех трёх журналов (с автоматической миграцией старых записей)
  const [lessons] = useState(() => {
    try {
      const saved = localStorage.getItem('vgtk_lessons');
      if (saved) {
        const parsed = JSON.parse(saved);
        const hasNewMocks = parsed.some(l => l.subjectId === 'subj-db');
        const normalized = parsed.map(l => ({ ...l, subjectId: l.subjectId || 'subj-kp' }));
        if (!hasNewMocks) {
          const extraMocks = mockLessons.filter(m => m.subjectId !== 'subj-kp');
          return [...normalized, ...extraMocks];
        }
        return normalized;
      }
      return mockLessons;
    } catch {
      return mockLessons;
    }
  });

  // 3. Загружаем оценки всех трёх журналов
  const [grades] = useState(() => {
    try {
      const saved = localStorage.getItem('vgtk_grades');
      if (saved) {
        const parsed = JSON.parse(saved);
        const hasDbGrades = parsed.some(g => g.lessonId === 'db1');
        if (!hasDbGrades) {
          const extraGrades = mockGrades.filter(
            g => g.lessonId.startsWith('db') || g.lessonId.startsWith('web')
          );
          return [...parsed, ...extraGrades];
        }
        return parsed;
      }
      return mockGrades;
    } catch {
      return mockGrades;
    }
  });

  // 4. Загружаем разметку пропусков куратора (Форма №6)
  const [curatorOverrides] = useState(() => {
    try {
      const saved = localStorage.getItem('vgtk_form6_overrides');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // 5. Загружаем конфигурацию ЛАБ/ПР по каждому предмету отдельно
  const [worksConfigsBySubject] = useState(() => {
    try {
      const saved = localStorage.getItem('vgtk_works_config_by_subject');
      return saved ? JSON.parse(saved) : DEFAULT_SUBJECT_CONFIGS;
    } catch {
      return DEFAULT_SUBJECT_CONFIGS;
    }
  });

  // 6. Загружаем отмеченные галочки сдачи ЛАБ/ПР по каждому предмету
  const [worksCompletionsBySubject] = useState(() => {
    try {
      const saved = localStorage.getItem('vgtk_works_completion_by_subject');
      return saved
        ? JSON.parse(saved)
        : {
            'subj-kp_s1_LAB_1': true,
            'subj-kp_s1_LAB_2': true,
            'subj-kp_s1_PR_1': true,
            'subj-kp_s4_LAB_1': true,
            'subj-db_s1_LAB_1': true,
            'subj-web_s1_LAB_1': true,
            'subj-web_s6_LAB_1': true
          };
    } catch {
      return {};
    }
  });

  const [selectedStudentId, setSelectedStudentId] = useState(students[0]?.id || 's1');
  const [activeTab, setActiveTab] = useState('grades'); // 'grades' | 'topics' | 'attendance' | 'schedule'
  const [selectedSubjectId, setSelectedSubjectId] = useState('subj-kp');

  const currentStudent = students.find(s => s.id === selectedStudentId) || students[0];

  // Собираем полные живые данные по каждому предмету для выбранного студента
  const subjectsStats = SUBJECTS_CATALOG.map((subject) => {
    const subjLessons = lessons
      .filter(l => (l.subjectId || 'subj-kp') === subject.subjectId)
      .sort((a, b) => getLessonTimestamp(a) - getLessonTimestamp(b));

    const subjLessonIds = subjLessons.map(l => l.id);

    const subjGrades = grades.filter(
      g => g.studentId === currentStudent.id && subjLessonIds.includes(g.lessonId)
    );

    const numericValues = subjGrades
      .filter(g => g.attendance !== 'ABSENT' && g.grade !== null && g.grade !== '')
      .map(g => Number(g.grade))
      .filter(v => !isNaN(v));

    const avg = numericValues.length > 0
      ? Number((numericValues.reduce((sum, v) => sum + v, 0) / numericValues.length).toFixed(2))
      : null;

    const absentHours = subjGrades.filter(g => g.attendance === 'ABSENT').length;

    // Формируем список ЛАБ и ПР конкретно для этого предмета
    const cfg = worksConfigsBySubject[subject.subjectId] || { labsCount: 0, practicalsCount: 0 };
    const labWorks = Array.from({ length: Number(cfg.labsCount) || 0 }, (_, i) => ({
      id: `LAB_${i + 1}`,
      label: `ЛАБ №${i + 1}`,
      type: 'ЛАБ'
    }));
    const prWorks = Array.from({ length: Number(cfg.practicalsCount) || 0 }, (_, i) => ({
      id: `PR_${i + 1}`,
      label: `ПР №${i + 1}`,
      type: 'ПР'
    }));

    const worksList = [...labWorks, ...prWorks].map(w => ({
      ...w,
      isDone: Boolean(worksCompletionsBySubject[`${subject.subjectId}_${currentStudent.id}_${w.id}`])
    }));

    const completedWorksCount = worksList.filter(w => w.isDone).length;

    return {
      ...subject,
      lessons: subjLessons,
      grades: subjGrades,
      avg,
      absentHours,
      worksList,
      completedWorksCount,
      totalWorksCount: worksList.length
    };
  });

  // Общий средний балл по всем предметам, где есть оценки
  const subjectsWithAvg = subjectsStats.filter(s => s.avg !== null);
  const overallAvg = subjectsWithAvg.length > 0
    ? (subjectsWithAvg.reduce((sum, s) => sum + s.avg, 0) / subjectsWithAvg.length).toFixed(2)
    : null;

  // Суммарный прогресс сдачи ЛАБ/ПР по всем предметам сразу
  const totalWorksAllSubjects = subjectsStats.reduce((sum, s) => sum + s.totalWorksCount, 0);
  const completedWorksAllSubjects = subjectsStats.reduce((sum, s) => sum + s.completedWorksCount, 0);

  // Почасовая статистика пропусков за месяц по всем предметам (синхронизирована с Формой №6)
  const daysInMonth = Array.from({ length: 31 }, (_, i) => i + 1);
  const journalHoursByDay = {};
  grades.forEach(g => {
    if (g.studentId === currentStudent.id && g.attendance === 'ABSENT') {
      const lesson = lessons.find(l => l.id === g.lessonId);
      const day = lesson?.day || parseInt(lesson?.date?.split('.')[0], 10);
      if (day) {
        journalHoursByDay[day] = (journalHoursByDay[day] || 0) + 1;
      }
    }
  });

  const getStudentDayAbsence = (day) => {
    const key = `${currentStudent.id}_${day}`;
    const journalHours = journalHoursByDay[day] || 0;
    const override = curatorOverrides[key];

    if (override?.cleared) return null;
    if (override?.reason === 'Сп') {
      return { day, reason: 'Сп', hours: 0 };
    }

    const effectiveHours =
      override?.customHours !== undefined && override?.customHours !== null
        ? Number(override.customHours)
        : journalHours;

    if (effectiveHours <= 0) return null;

    return {
      day,
      reason: override?.reason || 'Н/У',
      hours: effectiveHours
    };
  };

  const monthlyAbsences = daysInMonth.map(getStudentDayAbsence).filter(Boolean);

  const attendanceSummary = monthlyAbsences.reduce(
    (acc, item) => {
      if (item.reason === 'Сп') {
        acc.freeDays += 1;
        return acc;
      }
      const h = Number(item.hours) || 0;
      if (['Б', 'О', 'З', 'К'].includes(item.reason)) {
        acc[item.reason] += h;
        acc.excusedTotal += h;
      } else {
        acc['Н/У'] += h;
      }
      acc.grandTotal += h;
      return acc;
    },
    { 'Б': 0, 'О': 0, 'З': 0, 'К': 0, excusedTotal: 0, 'Н/У': 0, grandTotal: 0, freeDays: 0 }
  );

  const getBadgeColor = (avg) => {
    if (!avg) return 'bg-gray-100 text-gray-500 border-gray-200';
    const num = parseFloat(avg);
    if (num >= 8) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    if (num >= 5) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (num >= 4) return 'bg-amber-100 text-amber-800 border-amber-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

  const activeSubjectForTopics =
    subjectsStats.find(s => s.subjectId === selectedSubjectId) || subjectsStats[0];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Шапка профиля учащегося с переключателем студента */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-blue-600 text-white rounded-2xl shadow-sm">
            <GraduationCap size={28} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold text-gray-900">
                {currentStudent?.fullName}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-700">
                Группа {currentStudent?.groupName || 'ПО-31'}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                currentStudent?.subgroup === 1
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-emerald-100 text-emerald-800'
              }`}>
                {currentStudent?.subgroup}-я подгруппа
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              Личный кабинет учащегося ВГТК • Живая синхронизация со всеми предметными журналами
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 bg-gray-50 px-3.5 py-2 rounded-xl border border-gray-200 self-start lg:self-center">
          <User size={16} className="text-blue-600 shrink-0" />
          <span className="text-xs font-bold text-gray-500 uppercase whitespace-nowrap">
            Просмотр от лица:
          </span>
          <select
            value={selectedStudentId}
            onChange={(e) => setSelectedStudentId(e.target.value)}
            className="text-sm font-bold text-gray-900 bg-white border border-gray-300 rounded-lg px-2.5 py-1 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            {students.map(st => (
              <option key={st.id} value={st.id}>
                {st.fullName} ({st.subgroup} п/г)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Сводные KPI-карточки учащегося */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl">
            <Award size={24} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-semibold uppercase">Общий средний балл</p>
            <h3 className="text-2xl font-extrabold text-gray-900">
              {overallAvg || '—'}
            </h3>
            <p className="text-[11px] text-gray-400">По {subjectsWithAvg.length} из {subjectsStats.length} дисциплин</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
            <CheckSquare size={24} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-semibold uppercase">Сдано ЛАБ и ПР (Всего)</p>
            <h3 className="text-2xl font-extrabold text-gray-900">
              {completedWorksAllSubjects} <span className="text-sm font-semibold text-gray-400">из {totalWorksAllSubjects}</span>
            </h3>
            <p className="text-[11px] text-gray-400">По всем 3 предметам</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-sky-100 text-sky-600 rounded-xl">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-semibold uppercase">Уважительные пропуски</p>
            <h3 className="text-2xl font-extrabold text-sky-900">
              {attendanceSummary.excusedTotal} ч.
            </h3>
            <p className="text-[11px] text-gray-400">Закрыто документами (Б, О, З, К)</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-4">
          <div className={`p-3 rounded-xl ${
            attendanceSummary['Н/У'] > 0 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'
          }`}>
            <Clock size={24} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-semibold uppercase">Неуважительные (Н/У)</p>
            <h3 className={`text-2xl font-extrabold ${
              attendanceSummary['Н/У'] > 0 ? 'text-red-600' : 'text-gray-900'
            }`}>
              {attendanceSummary['Н/У']} ч.
            </h3>
            <p className="text-[11px] text-gray-400">Всего за месяц: {attendanceSummary.grandTotal} ч.</p>
          </div>
        </div>
      </div>

      {/* Вкладки навигации */}
      <div className="flex flex-wrap gap-2 bg-white p-2 rounded-2xl border border-gray-200 shadow-xs">
        <button
          onClick={() => setActiveTab('grades')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'grades'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Award size={17} />
          <span>Мои оценки и сдача ЛАБ/ПР</span>
        </button>

        <button
          onClick={() => setActiveTab('topics')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'topics'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <BookOpen size={17} />
          <span>Пройденные темы и ДЗ</span>
        </button>

        <button
          onClick={() => setActiveTab('attendance')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'attendance'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <FileText size={17} />
          <span>Статистика пропусков за месяц</span>
        </button>

        <button
          onClick={() => setActiveTab('schedule')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'schedule'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Calendar size={17} />
          <span>Расписание группы</span>
        </button>
      </div>

      {/* ВКЛАДКА 1: ОЦЕНКИ И СТАТУС СДАЧИ ЛАБ/ПР ПО КАЖДОМУ ПРЕДМЕТУ */}
      {activeTab === 'grades' && (
        <div className="space-y-5">
          {subjectsStats.map((subj) => {
            const positiveGrades = subj.grades.filter(g => g.attendance !== 'ABSENT' && g.grade);

            return (
              <div key={subj.subjectId} className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
                {/* Шапка предмета */}
                <div className="p-5 border-b border-gray-100 bg-gray-50/60 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">{subj.name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Преподаватель: {subj.teacher} • Пропусков по предмету: <b>{subj.absentHours} ч.</b>
                    </p>
                  </div>

                  <div className="flex items-center gap-4 self-start md:self-center">
                    <button
                      onClick={() => {
                        setSelectedSubjectId(subj.subjectId);
                        setActiveTab('topics');
                      }}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800 underline decoration-dotted cursor-pointer"
                    >
                      Темы и ДЗ ({subj.lessons.length}) →
                    </button>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-500">Ср. балл:</span>
                      <span className={`px-3 py-1 rounded-lg text-sm font-extrabold border ${getBadgeColor(subj.avg)}`}>
                        {subj.avg ? subj.avg.toFixed(2) : '—'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Тело карточки предмета: Оценки + Сетка ЛАБ/ПР этого предмета */}
                <div className="p-5 space-y-4">
                  {/* Лента оценок */}
                  <div>
                    <div className="text-[11px] font-bold text-gray-400 uppercase mb-2">
                      Полученные оценки по датам
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {positiveGrades.length > 0 ? (
                        positiveGrades.map((g, idx) => {
                          const lesson = subj.lessons.find(l => l.id === g.lessonId);
                          return (
                            <div
                              key={`${g.lessonId}-${g.hourIndex || idx}`}
                              title={lesson?.topic ? `${lesson.date} (${lesson.type}): ${lesson.topic}` : ''}
                              className="flex flex-col items-center px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-200 min-w-[64px]"
                            >
                              <span className="text-[10px] font-semibold text-gray-500">
                                {lesson?.date || '—'} {lesson?.type ? `• ${lesson.type}` : ''}
                              </span>
                              <span className="text-base font-extrabold text-gray-900 mt-0.5">
                                {g.grade}
                              </span>
                            </div>
                          );
                        })
                      ) : (
                        <span className="text-xs text-gray-400 italic">По данному предмету оценок пока нет</span>
                      )}
                    </div>
                  </div>

                  {/* Независимый блок сдачи ЛАБ и ПР конкретно по этому предмету */}
                  {subj.worksList.length > 0 && (
                    <div className="pt-3 border-t border-gray-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-gray-500 uppercase">
                          Сдача лабораторных и практических работ по дисциплине
                        </span>
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                          Сдано: {subj.completedWorksCount} из {subj.totalWorksCount}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {subj.worksList.map(work => (
                          <div
                            key={work.id}
                            className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 ${
                              work.isDone
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                : 'bg-gray-50 border-gray-200 text-gray-400'
                            }`}
                          >
                            {work.isDone && <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />}
                            <span>{work.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ВКЛАДКА 2: ПРОЙДЕННЫЕ ТЕМЫ И ДОМАШНИЕ ЗАДАНИЯ ПО ПРЕДМЕТАМ */}
      {activeTab === 'topics' && (
        <div className="space-y-5">
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-gray-500 uppercase mr-2">Выберите предмет:</span>
            {subjectsStats.map(subj => (
              <button
                key={subj.subjectId}
                onClick={() => setSelectedSubjectId(subj.subjectId)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeSubjectForTopics.subjectId === subj.subjectId
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {subj.name}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-gray-100 bg-gray-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-gray-900">{activeSubjectForTopics.name}</h2>
                <p className="text-xs text-gray-500">
                  Преподаватель: {activeSubjectForTopics.teacher} • Темы и домашние задания из журнала дисциплины
                </p>
              </div>
              <span className="text-xs font-bold px-3 py-1 bg-blue-50 text-blue-700 rounded-lg border border-blue-100 self-start sm:self-center">
                Занятий: {activeSubjectForTopics.lessons.length}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-700 uppercase bg-gray-100 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 w-14 text-center">№</th>
                    <th className="px-4 py-3 w-24 text-center">Дата</th>
                    <th className="px-4 py-3 w-32 text-center">Тип / Часы</th>
                    <th className="px-4 py-3">Тема занятия</th>
                    <th className="px-4 py-3">Домашнее задание</th>
                    <th className="px-4 py-3 w-32 text-center">Ваша отметка</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {activeSubjectForTopics.lessons.map((lesson, idx) => {
                    const lessonGrades = activeSubjectForTopics.grades.filter(g => g.lessonId === lesson.id);

                    return (
                      <tr key={lesson.id} className="hover:bg-blue-50/20 transition-colors">
                        <td className="px-4 py-3.5 text-center font-bold text-gray-400">#{idx + 1}</td>
                        <td className="px-4 py-3.5 text-center font-bold text-gray-900">{lesson.date}</td>
                        <td className="px-4 py-3.5 text-center">
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-bold mr-1">
                            {lesson.type}
                          </span>
                          <span className="text-xs text-gray-500 font-medium">
                            ({lesson.hours === 1 ? '1 ч.' : '2 ч.'})
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-medium text-gray-900">
                          {lesson.topic || <span className="text-gray-400 italic">Тема не указана</span>}
                        </td>
                        <td className="px-4 py-3.5">
                          {lesson.homework ? (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50/70 text-blue-900 border border-blue-100 text-xs font-medium">
                              <Home size={13} className="text-blue-600 shrink-0" />
                              <span>{lesson.homework}</span>
                            </div>
                          ) : (
                            <span className="text-gray-400 italic text-xs">Не задано</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          {lessonGrades.length > 0 ? (
                            <div className="inline-flex items-center gap-1.5">
                              {lessonGrades.map((g, gIdx) => (
                                <span
                                  key={gIdx}
                                  className={`px-2.5 py-0.5 rounded-lg text-xs font-extrabold border ${
                                    g.attendance === 'ABSENT'
                                      ? 'bg-red-50 text-red-600 border-red-200'
                                      : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  }`}
                                >
                                  {g.attendance === 'ABSENT' ? 'Н (1 ч.)' : g.grade}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {activeSubjectForTopics.lessons.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">
                        В журнале этого предмета занятия пока не созданы
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ВКЛАДКА 3: СТАТИСТИКА ПРОПУСКОВ ЗА МЕСЯЦ */}
      {activeTab === 'attendance' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {ABSENCE_TYPES.map(type => {
              const value = type.code === 'Сп' ? `${attendanceSummary.freeDays} дн.` : `${attendanceSummary[type.code] || 0} ч.`;
              return (
                <div key={type.code} className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs">
                  <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold border ${type.color}`}>
                    {type.label}
                  </span>
                  <div className="text-2xl font-extrabold text-gray-900 mt-2">{value}</div>
                </div>
              );
            })}
          </div>

          {attendanceSummary['Н/У'] > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
              <AlertTriangle size={20} className="text-red-600 shrink-0 mt-0.5" />
              <div className="text-xs text-red-900">
                <span className="font-bold block text-sm mb-0.5">
                  У вас числится {attendanceSummary['Н/У']} ч. пропусков по неуважительной причине (Н/У)
                </span>
                Предоставьте куратору подтверждающий документ (больничный лист, заявление или объяснительную), чтобы перевести часы в категорию уважительных в ведомости «Форма №6».
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-gray-100 bg-gray-50/60 flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-gray-900">Календарь посещаемости за месяц (Числа 1–31)</h3>
                <p className="text-xs text-gray-500">Данные синхронизированы со всеми предметными журналами и ведомостью куратора «Форма №6»</p>
              </div>
              <span className="text-xs font-bold text-gray-700 bg-gray-100 px-3 py-1.5 rounded-xl">
                Итого пропущено: {attendanceSummary.grandTotal} ч.
              </span>
            </div>

            <div className="p-5">
              <div className="grid grid-cols-7 sm:grid-cols-11 md:grid-cols-16 gap-2">
                {daysInMonth.map(day => {
                  const entry = getStudentDayAbsence(day);
                  const meta = ABSENCE_TYPES.find(t => t.code === entry?.reason);

                  return (
                    <div
                      key={day}
                      className={`p-2 rounded-xl border text-center flex flex-col items-center justify-between min-h-[64px] ${
                        entry ? `${meta?.color || ''}` : 'bg-gray-50/60 border-gray-200 text-gray-400'
                      }`}
                    >
                      <span className="text-[11px] font-bold">{day} число</span>
                      {entry ? (
                        <div className="mt-1">
                          <span className="text-sm font-extrabold block leading-tight">
                            {entry.reason === 'Сп' ? 'Сп' : `${entry.hours} ч.`}
                          </span>
                          {entry.reason !== 'Сп' && (
                            <span className="text-[10px] font-bold uppercase">{entry.reason}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-emerald-600 font-semibold mt-1">Явка</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ВКЛАДКА 4: РАСПИСАНИЕ ГРУППЫ */}
      {activeTab === 'schedule' && (
        <ScheduleWidget
          isCuratorView={true}
          groupFilter={currentStudent?.groupName || 'ПО-31'}
        />
      )}
    </div>
  );
}