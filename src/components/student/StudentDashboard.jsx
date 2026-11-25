import { useState } from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { mockStudents, mockLessons, mockGrades } from '../../mocks/initialData';
import ScheduleWidget from '../dashboard/ScheduleWidget';
import { getLessonTimestamp } from '../journal/lessonDate';

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
  {
    code: 'Б',
    label: 'Больничный (Б)',
    color: 'bg-sky-100 dark:bg-sky-500/20 text-sky-900 dark:text-sky-300 border-sky-300 dark:border-sky-500/30',
    isExcused: true
  },
  {
    code: 'О',
    label: 'Объяснительная (О)',
    color: 'bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-500/30',
    isExcused: true
  },
  {
    code: 'З',
    label: 'Заявление (З)',
    color: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-900 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30',
    isExcused: true
  },
  {
    code: 'К',
    label: 'Мероприятия (К)',
    color: 'bg-teal-100 dark:bg-teal-500/20 text-teal-900 dark:text-teal-300 border-teal-300 dark:border-teal-500/30',
    isExcused: true
  },
  {
    code: 'Н/У',
    label: 'Неуважительная (Н/У)',
    color: 'bg-rose-100 dark:bg-rose-500/20 text-rose-900 dark:text-rose-300 border-rose-300 dark:border-rose-500/30',
    isExcused: false
  },
  {
    code: 'Сп',
    label: 'Свободное посещение (Сп)',
    color: 'bg-stone-200 dark:bg-zinc-700/60 text-stone-800 dark:text-zinc-200 border-stone-400 dark:border-zinc-600',
    isFree: true
  },
];

export default function StudentDashboard() {
  const [students] = useState(() => {
    try {
      const saved = localStorage.getItem('vgtk_students');
      return saved ? JSON.parse(saved) : mockStudents;
    } catch {
      return mockStudents;
    }
  });

  const [lessons] = useState(() => {
    try {
      const saved = localStorage.getItem('vgtk_lessons');
      if (saved) {
        const parsed = JSON.parse(saved);
        const hasNewMocks = parsed.some((l) => l.subjectId === 'subj-db');
        const normalized = parsed.map((l) => ({ ...l, subjectId: l.subjectId || 'subj-kp' }));
        if (!hasNewMocks) {
          const extraMocks = mockLessons.filter((m) => m.subjectId !== 'subj-kp');
          return [...normalized, ...extraMocks];
        }
        return normalized;
      }
      return mockLessons;
    } catch {
      return mockLessons;
    }
  });

  const [grades] = useState(() => {
    try {
      const saved = localStorage.getItem('vgtk_grades');
      if (saved) {
        const parsed = JSON.parse(saved);
        const hasDbGrades = parsed.some((g) => g.lessonId === 'db1');
        if (!hasDbGrades) {
          const extraGrades = mockGrades.filter(
            (g) => g.lessonId.startsWith('db') || g.lessonId.startsWith('web')
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

  const [curatorOverrides] = useState(() => {
    try {
      const saved = localStorage.getItem('vgtk_form6_overrides');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [worksConfigsBySubject] = useState(() => {
    try {
      const saved = localStorage.getItem('vgtk_works_config_by_subject');
      return saved ? JSON.parse(saved) : DEFAULT_SUBJECT_CONFIGS;
    } catch {
      return DEFAULT_SUBJECT_CONFIGS;
    }
  });

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
  const [activeTab, setActiveTab] = useState('grades');
  const [selectedSubjectId, setSelectedSubjectId] = useState('subj-kp');

  const currentStudent = students.find((s) => s.id === selectedStudentId) || students[0];

  const subjectsStats = SUBJECTS_CATALOG.map((subject) => {
    const subjLessons = lessons
      .filter((l) => (l.subjectId || 'subj-kp') === subject.subjectId)
      .sort((a, b) => getLessonTimestamp(a) - getLessonTimestamp(b));

    const subjLessonIds = subjLessons.map((l) => l.id);

    const subjGrades = grades.filter(
      (g) => g.studentId === currentStudent.id && subjLessonIds.includes(g.lessonId)
    );

    const numericValues = subjGrades
      .filter((g) => g.attendance !== 'ABSENT' && g.grade !== null && g.grade !== '')
      .map((g) => Number(g.grade))
      .filter((v) => !isNaN(v));

    const avg = numericValues.length > 0
      ? Number((numericValues.reduce((sum, v) => sum + v, 0) / numericValues.length).toFixed(2))
      : null;

    const absentHours = subjGrades.filter((g) => g.attendance === 'ABSENT').length;

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

    const worksList = [...labWorks, ...prWorks].map((w) => ({
      ...w,
      isDone: Boolean(worksCompletionsBySubject[`${subject.subjectId}_${currentStudent.id}_${w.id}`])
    }));

    const completedWorksCount = worksList.filter((w) => w.isDone).length;

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

  const subjectsWithAvg = subjectsStats.filter((s) => s.avg !== null);
  const overallAvg = subjectsWithAvg.length > 0
    ? (subjectsWithAvg.reduce((sum, s) => sum + s.avg, 0) / subjectsWithAvg.length).toFixed(2)
    : null;

  const totalWorksAllSubjects = subjectsStats.reduce((sum, s) => sum + s.totalWorksCount, 0);
  const completedWorksAllSubjects = subjectsStats.reduce((sum, s) => sum + s.completedWorksCount, 0);

  const daysInMonth = Array.from({ length: 31 }, (_, i) => i + 1);
  const journalHoursByDay = {};
  grades.forEach((g) => {
    if (g.studentId === currentStudent.id && g.attendance === 'ABSENT') {
      const lesson = lessons.find((l) => l.id === g.lessonId);
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
    if (!avg) return 'bg-[var(--soft)] text-stone-500 dark:text-zinc-400 border-[#D8D1C5] dark:border-[#323844]';
    const num = parseFloat(avg);
    if (num >= 8) return 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-900 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30';
    if (num >= 5) return 'bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-500/30';
    if (num >= 4) return 'bg-orange-100 dark:bg-orange-500/20 text-orange-800 dark:text-orange-300 border-orange-300 dark:border-orange-500/30';
    return 'bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-500/30';
  };

  const activeSubjectForTopics =
    subjectsStats.find((s) => s.subjectId === selectedSubjectId) || subjectsStats[0];

  return (
    <div className="space-y-6">
      <header className="page-heading">
        <div>
          <p className="section-kicker">Кабинет учащегося</p>
          <h1>{currentStudent?.fullName}</h1>
          <p>Группа {currentStudent?.groupName || 'ПО-31'} · {currentStudent?.subgroup}-я подгруппа</p>
        </div>
        <label className="field-label">Учащийся
          <select value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)}>
            {students.map((st) => <option key={st.id} value={st.id}>{st.fullName} ({st.subgroup} п/г)</option>)}
          </select>
        </label>
      </header>
      <dl className="metric-strip">
        <div><dt>Средний балл</dt><dd>{overallAvg || '—'}</dd><small>По {subjectsWithAvg.length} из {subjectsStats.length} дисциплин</small></div>
        <div><dt>Сдано работ</dt><dd>{completedWorksAllSubjects} <small>из {totalWorksAllSubjects}</small></dd></div>
        <div><dt>Уважительные пропуски</dt><dd>{attendanceSummary.excusedTotal} ч.</dd></div>
        <div><dt>Неуважительные пропуски</dt><dd>{attendanceSummary['Н/У']} ч.</dd><small>Всего пропущено {attendanceSummary.grandTotal} ч.</small></div>
      </dl>
      <div className="section-tabs" role="group" aria-label="Раздел кабинета">
        {[
          ['grades', 'Оценки и работы'],
          ['topics', 'Темы и задания'],
          ['attendance', 'Посещаемость'],
          ['schedule', 'Расписание'],
        ].map(([id, label]) => (
          <button key={id} aria-pressed={activeTab === id} onClick={() => setActiveTab(id)}>{label}</button>
        ))}
      </div>

      {activeTab === 'grades' && (
        <div className="space-y-5">
          {subjectsStats.map((subj) => {
            const positiveGrades = subj.grades.filter((g) => g.attendance !== 'ABSENT' && g.grade);

            return (
              <div key={subj.subjectId} className="bg-[var(--card)] rounded-sm border border-[var(--line)] shadow-sm overflow-hidden transition-colors duration-300">
                <div className="p-5 border-b border-[var(--line)] bg-[var(--soft)] flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-stone-900 dark:text-zinc-100 text-base">{subj.name}</h3>
                    <p className="text-xs text-stone-600 dark:text-zinc-400 mt-0.5">
                      Преподаватель: {subj.teacher} • Пропусков по предмету: <b>{subj.absentHours} ч.</b>
                    </p>
                  </div>

                  <div className="flex items-center gap-4 self-start md:self-center">
                    <button
                      onClick={() => {
                        setSelectedSubjectId(subj.subjectId);
                        setActiveTab('topics');
                      }}
                      className="text-xs font-bold text-emerald-900 dark:text-amber-300 hover:text-emerald-700 dark:hover:text-amber-200 underline decoration-dotted cursor-pointer"
                    >
                      Темы и ДЗ ({subj.lessons.length}) →
                    </button>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-stone-600 dark:text-zinc-400">Ср. балл:</span>
                      <span className={`px-3 py-1 rounded-lg text-sm font-extrabold border ${getBadgeColor(subj.avg)}`}>
                        {subj.avg ? subj.avg.toFixed(2) : '—'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  <div>
                    <div className="text-[11px] font-bold text-stone-500 dark:text-zinc-400 uppercase mb-2">
                      Полученные оценки по датам
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {positiveGrades.length > 0 ? (
                        positiveGrades.map((g, idx) => {
                          const lesson = subj.lessons.find((l) => l.id === g.lessonId);
                          return (
                            <div
                              key={`${g.lessonId}-${g.hourIndex || idx}`}
                              title={lesson?.topic ? `${lesson.date} (${lesson.type}): ${lesson.topic}` : ''}
                              className="flex flex-col items-center px-3 py-1.5 rounded-sm bg-[#F3EFE8] dark:bg-[#22262E] border border-[#D8D1C5] dark:border-[#323844] min-w-[64px]"
                            >
                              <span className="text-[10px] font-bold text-stone-500 dark:text-zinc-400">
                                {lesson?.date || '—'} {lesson?.type ? `• ${lesson.type}` : ''}
                              </span>
                              <span className="text-base font-extrabold text-stone-900 dark:text-zinc-100 mt-0.5">
                                {g.grade}
                              </span>
                            </div>
                          );
                        })
                      ) : (
                        <span className="text-xs text-stone-400 dark:text-zinc-500 italic">По данному предмету оценок пока нет</span>
                      )}
                    </div>
                  </div>

                  {subj.worksList.length > 0 && (
                    <div className="pt-3 border-t border-[#EAE4DC] dark:border-[#262A32]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-stone-600 dark:text-zinc-400 uppercase">
                          Сдача лабораторных и практических работ по дисциплине
                        </span>
                        <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-500/20 px-2.5 py-0.5 rounded-md border border-emerald-300 dark:border-emerald-500/30">
                          Сдано: {subj.completedWorksCount} из {subj.totalWorksCount}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {subj.worksList.map((work) => (
                          <div
                            key={work.id}
                            className={`px-3 py-1.5 rounded-sm border text-xs font-bold flex items-center gap-1.5 ${
                              work.isDone
                                ? 'bg-emerald-100/80 dark:bg-emerald-500/20 border-emerald-300 dark:border-emerald-500/30 text-emerald-950 dark:text-emerald-300'
                                : 'bg-[#F3EFE8] dark:bg-[#22262E] border-[#D8D1C5] dark:border-[#323844] text-stone-500 dark:text-zinc-400'
                            }`}
                          >
                            {work.isDone && <CheckCircle2 size={14} className="text-emerald-800 dark:text-emerald-400 shrink-0" />}
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

      {activeTab === 'topics' && (
        <div className="space-y-5">
          <div className="bg-[var(--card)] p-4 rounded-sm border border-[var(--line)] shadow-sm flex flex-wrap items-center gap-2 transition-colors duration-300">
            <span className="text-xs font-bold text-stone-600 dark:text-zinc-400 uppercase mr-2">Выберите предмет:</span>
            {subjectsStats.map((subj) => (
              <button
                key={subj.subjectId}
                onClick={() => setSelectedSubjectId(subj.subjectId)}
                className={`px-3.5 py-2 rounded-sm text-xs font-bold transition-all cursor-pointer ${
                  activeSubjectForTopics.subjectId === subj.subjectId
                    ? 'bg-[#244b3c] text-white shadow-xs'
                    : 'bg-[var(--soft)] text-stone-700 dark:text-zinc-300 hover:bg-[#E2DCD3] dark:hover:bg-[#2A2F3A]'
                }`}
              >
                {subj.name}
              </button>
            ))}
          </div>

          <div className="bg-[var(--card)] rounded-sm border border-[var(--line)] shadow-sm overflow-hidden transition-colors duration-300">
            <div className="p-5 border-b border-[var(--line)] bg-[var(--soft)] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-stone-900 dark:text-zinc-100">{activeSubjectForTopics.name}</h2>
                <p className="text-xs text-stone-600 dark:text-zinc-400">
                  Преподаватель: {activeSubjectForTopics.teacher} • Темы и домашние задания из журнала дисциплины
                </p>
              </div>
              <span className="text-xs font-bold px-3 py-1 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-900 dark:text-emerald-300 rounded-lg border border-emerald-300 dark:border-emerald-500/30 self-start sm:self-center">
                Занятий: {activeSubjectForTopics.lessons.length}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-stone-800 dark:text-zinc-200 uppercase bg-[#F5F2EC] dark:bg-[#1E2128] border-b border-[#D8D1C5] dark:border-[#2E333D]">
                  <tr>
                    <th className="px-4 py-3 w-14 text-center">№</th>
                    <th className="px-4 py-3 w-24 text-center">Дата</th>
                    <th className="px-4 py-3 w-32 text-center">Тип / Часы</th>
                    <th className="px-4 py-3">Тема занятия</th>
                    <th className="px-4 py-3">Домашнее задание</th>
                    <th className="px-4 py-3 w-32 text-center">Ваша отметка</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAE4DC] dark:divide-[#262A32]">
                  {activeSubjectForTopics.lessons.map((lesson, idx) => {
                    const lessonGrades = activeSubjectForTopics.grades.filter((g) => g.lessonId === lesson.id);

                    return (
                      <tr key={lesson.id} className="hover:bg-[#F3EFE8] dark:hover:bg-[#22262E] transition-colors">
                        <td className="px-4 py-3.5 text-center font-bold text-stone-500 dark:text-zinc-400">#{idx + 1}</td>
                        <td className="px-4 py-3.5 text-center font-bold text-stone-900 dark:text-zinc-100">{lesson.date}</td>
                        <td className="px-4 py-3.5 text-center">
                          <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-900 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 rounded text-xs font-bold mr-1">
                            {lesson.type}
                          </span>
                          <span className="text-xs text-stone-600 dark:text-zinc-400 font-medium">
                            ({lesson.hours === 1 ? '1 ч.' : '2 ч.'})
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-medium text-stone-900 dark:text-zinc-100">
                          {lesson.topic || <span className="text-stone-400 dark:text-zinc-500 italic">Тема не указана</span>}
                        </td>
                        <td className="px-4 py-3.5">
                          {lesson.homework ? (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-100/60 dark:bg-amber-500/15 text-stone-900 dark:text-amber-200 border border-amber-300 dark:border-amber-500/30 text-xs font-medium">
                              <span>{lesson.homework}</span>
                            </div>
                          ) : (
                            <span className="text-stone-400 dark:text-zinc-500 italic text-xs">Не задано</span>
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
                                      ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-500/30'
                                      : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-900 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30'
                                  }`}
                                >
                                  {g.attendance === 'ABSENT' ? 'Н (1 ч.)' : g.grade}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-stone-400 dark:text-zinc-500 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'attendance' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {ABSENCE_TYPES.map((type) => {
              const value = type.code === 'Сп' ? `${attendanceSummary.freeDays} дн.` : `${attendanceSummary[type.code] || 0} ч.`;
              return (
                <div key={type.code} className="bg-[var(--card)] p-4 rounded-sm border border-[var(--line)] shadow-sm transition-colors duration-300">
                  <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold border ${type.color}`}>
                    {type.label}
                  </span>
                  <div className="text-2xl font-extrabold text-stone-900 dark:text-zinc-100 mt-2">{value}</div>
                </div>
              );
            })}
          </div>

          {attendanceSummary['Н/У'] > 0 && (
            <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-500/40 rounded-sm p-4 flex items-start gap-3">
              <AlertTriangle size={20} className="text-rose-700 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="text-xs text-rose-950 dark:text-rose-200">
                <span className="font-bold block text-sm mb-0.5">
                  У вас числится {attendanceSummary['Н/У']} ч. пропусков по неуважительной причине (Н/У)
                </span>
                Предоставьте куратору подтверждающий документ (больничный лист, заявление или объяснительную), чтобы перевести часы в категорию уважительных в ведомости «Форма №6».
              </div>
            </div>
          )}

          <div className="bg-[var(--card)] rounded-sm border border-[var(--line)] shadow-sm overflow-hidden transition-colors duration-300">
            <div className="p-5 border-b border-[var(--line)] bg-[var(--soft)] flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-stone-900 dark:text-zinc-100">Календарь посещаемости</h3>
                <p className="text-xs text-stone-600 dark:text-zinc-400">Данные синхронизированы со всеми предметными журналами и ведомостью куратора «Форма №6»</p>
              </div>
              <span className="text-xs font-bold text-stone-800 dark:text-zinc-200 bg-[#F3EFE8] dark:bg-[#181B20] border border-[#D8D1C5] dark:border-[#323844] px-3 py-1.5 rounded-sm">
                Итого пропущено: {attendanceSummary.grandTotal} ч.
              </span>
            </div>

            <div className="p-5">
              <div className="grid grid-cols-7 sm:grid-cols-11 md:grid-cols-16 gap-2">
                {daysInMonth.map((day) => {
                  const entry = getStudentDayAbsence(day);
                  const meta = ABSENCE_TYPES.find((t) => t.code === entry?.reason);

                  return (
                    <div
                      key={day}
                      className={`p-2 rounded-sm border text-center flex flex-col items-center justify-between min-h-[64px] ${
                        entry
                          ? `${meta?.color || ''}`
                          : 'bg-[#F3EFE8] dark:bg-[#22262E] border-[#E2DCD3] dark:border-[#2E333D] text-stone-500 dark:text-zinc-400'
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
                        <span className="text-[11px] text-emerald-800 dark:text-emerald-400 font-bold mt-1">Явка</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'schedule' && (
        <ScheduleWidget
          groupFilter={currentStudent?.groupName || 'ПО-31'}
        />
      )}
    </div>
  );
}
