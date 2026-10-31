import React, { useState, useEffect } from 'react';
import { Plus, Calendar, Users, Lock, BookOpen, ListChecks, CheckSquare, ShieldCheck } from 'lucide-react';
import { mockStudents, mockLessons, mockGrades } from '../../mocks/initialData';
import AddLessonModal, { getLessonTimestamp } from './AddLessonModal';
import SubgroupManagerModal from './SubgroupManagerModal';
import WorkCompletionModule from './WorkCompletionModule';

export default function JournalTable({
  sheetId,
  subjectId = 'subj-kp',
  subjectName = 'Конструирование программ и языки программирования',
  isMainSheet = true
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [isSubgroupModalOpen, setIsSubgroupModalOpen] = useState(false);
  const [showTopicsPanel, setShowTopicsPanel] = useState(true);
  const [showWorksModule, setShowWorksModule] = useState(true);

  const [students, setStudents] = useState(() => {
    try {
      const saved = localStorage.getItem('vgtk_students');
      return saved ? JSON.parse(saved) : mockStudents;
    } catch {
      return mockStudents;
    }
  });

  // Загружаем уроки; если в старом localStorage были записи без subjectId, дополняем их дефолтным 'subj-kp'
  const [allLessons, setAllLessons] = useState(() => {
    try {
      const saved = localStorage.getItem('vgtk_lessons');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Если в сохраненном массиве еще нет предметов db1/web1 из новых моков, объединим их
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

  const [grades, setGrades] = useState(() => {
    try {
      const saved = localStorage.getItem('vgtk_grades');
      if (saved) {
        const parsed = JSON.parse(saved);
        const hasDbGrades = parsed.some(g => g.lessonId === 'db1');
        if (!hasDbGrades) {
          const extraGrades = mockGrades.filter(g => g.lessonId.startsWith('db') || g.lessonId.startsWith('web'));
          return [...parsed, ...extraGrades];
        }
        return parsed;
      }
      return mockGrades;
    } catch {
      return mockGrades;
    }
  });

  const [editingCell, setEditingCell] = useState(null);

  useEffect(() => {
    localStorage.setItem('vgtk_students', JSON.stringify(students));
  }, [students]);

  useEffect(() => {
    localStorage.setItem('vgtk_lessons', JSON.stringify(allLessons));
  }, [allLessons]);

  useEffect(() => {
    localStorage.setItem('vgtk_grades', JSON.stringify(grades));
  }, [grades]);

  const isSubgroupLesson = (lesson) => {
    return lesson.type === 'ПР' || lesson.type === 'ЛАБ' || lesson.isSubgroupOnly;
  };

  // Фильтруем уроки СТРОГО по текущему предмету (subjectId)
  // И для второго преподавателя оставляем только ПР/ЛАБ этого предмета
  const lessons = allLessons
    .filter(lesson => (lesson.subjectId || 'subj-kp') === subjectId)
    .filter(lesson => {
      if (isMainSheet) return true;
      return isSubgroupLesson(lesson) && lesson.createdByMain !== false;
    })
    .sort((a, b) => getLessonTimestamp(a) - getLessonTimestamp(b));

  const visibleStudents = isMainSheet
    ? students
    : students.filter(s => s.subgroup === 2);

  const handleAddLesson = (newLessonData) => {
    const newLesson = {
      id: `l${Date.now()}`,
      subjectId: subjectId,
      sheetId: sheetId,
      createdByMain: true,
      isSubgroupOnly: newLessonData.type === 'ПР' || newLessonData.type === 'ЛАБ',
      ...newLessonData,
    };
    setAllLessons(prev => [...prev, newLesson]);
  };

  const handleUpdateLesson = (updatedLesson) => {
    setAllLessons(prev =>
      prev.map(l => (l.id === updatedLesson.id ? { ...updatedLesson, subjectId } : l))
    );
    if (Number(updatedLesson.hours) === 1) {
      setGrades(prev =>
        prev.filter(g => !(g.lessonId === updatedLesson.id && g.hourIndex === 2))
      );
    }
  };

  const handleDeleteLesson = (lessonId) => {
    setAllLessons(prev => prev.filter(l => l.id !== lessonId));
    setGrades(prev => prev.filter(g => g.lessonId !== lessonId));
  };

  const handleSaveGrade = (studentId, lessonId, hourIndex, value) => {
    const cleanValue = value.trim().toUpperCase();
    const filteredGrades = grades.filter(
      g => !(g.studentId === studentId && g.lessonId === lessonId && (g.hourIndex || 1) === hourIndex)
    );

    if (cleanValue === '') {
      setGrades(filteredGrades);
    } else if (cleanValue === 'Н') {
      setGrades([...filteredGrades, { lessonId, hourIndex, studentId, grade: null, attendance: 'ABSENT' }]);
    } else {
      setGrades([...filteredGrades, { lessonId, hourIndex, studentId, grade: cleanValue, attendance: 'PRESENT' }]);
    }
    setEditingCell(null);
  };

  const isCellLocked = (student, lesson) => {
    if (isMainSheet) {
      return isSubgroupLesson(lesson) && student.subgroup === 2;
    }
    return false;
  };

  const hourColumns = lessons.flatMap(lesson => {
    const count = lesson.hours === 1 ? 1 : 2;
    return Array.from({ length: count }, (_, idx) => ({
      lesson,
      hourIndex: idx + 1,
      totalHours: count,
      isLastHourOfLesson: idx + 1 === count
    }));
  });

  const getStudentStats = (student) => {
    const sheetLessonIds = lessons.map(lesson => lesson.id);

    const studentGrades = grades.filter(
      g => g.studentId === student.id && sheetLessonIds.includes(g.lessonId)
    );

    const numericGrades = studentGrades
      .filter(g => g.attendance !== 'ABSENT' && g.grade !== null && g.grade !== '')
      .map(g => Number(g.grade))
      .filter(val => !isNaN(val));

    const avg = numericGrades.length > 0
      ? (numericGrades.reduce((sum, val) => sum + val, 0) / numericGrades.length).toFixed(2)
      : null;

    const absentHours = studentGrades.filter(g => g.attendance === 'ABSENT').length;

    return { avg, absentHours };
  };

  const getAvgBadgeStyle = (avg) => {
    if (!avg) return 'text-gray-400';
    const num = parseFloat(avg);
    if (num >= 8) return 'bg-emerald-100 text-emerald-800 font-bold';
    if (num >= 5) return 'bg-blue-100 text-blue-800 font-bold';
    if (num >= 4) return 'bg-amber-100 text-amber-800 font-bold';
    return 'bg-red-100 text-red-800 font-bold';
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden pb-4">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3">
          <div className="flex items-center gap-3">
            <Calendar className={isMainSheet ? 'text-blue-600' : 'text-emerald-600'} size={24} />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900">
                  ПО-31 • {subjectName}
                </h2>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  isMainSheet ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {isMainSheet ? 'Главный преподаватель (Вся группа)' : '2-я подгруппа (Изолированный доступ)'}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {isMainSheet
                  ? 'Данные этого предмета изолированы от других дисциплин и синхронизированы со 2-й подгруппой'
                  : 'Отображаются только учащиеся 2-й подгруппы и слоты ЛАБ/ПР по данному предмету'}
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowWorksModule(prev => !prev)}
              className={`flex items-center gap-1.5 px-3.5 py-2 border text-xs font-bold rounded-lg transition-colors shadow-2xs cursor-pointer ${
                showWorksModule
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <CheckSquare size={15} />
              <span>Учёт сдачи ЛАБ/ПР</span>
            </button>

            <button
              onClick={() => setShowTopicsPanel(prev => !prev)}
              className={`flex items-center gap-1.5 px-3.5 py-2 border text-xs font-bold rounded-lg transition-colors shadow-2xs cursor-pointer ${
                showTopicsPanel
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <ListChecks size={15} />
              <span>Темы и ДЗ</span>
            </button>

            {isMainSheet && (
              <>
                <button 
                  onClick={() => setIsSubgroupModalOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-gray-200 text-gray-700 text-xs font-bold rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors shadow-2xs cursor-pointer"
                >
                  <Users size={15} className="text-blue-600" />
                  <span>Подгруппы</span>
                </button>

                <button 
                  onClick={() => {
                    setSelectedLesson(null);
                    setIsModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-sm cursor-pointer"
                >
                  <Plus size={15} />
                  <span>Добавить занятие</span>
                </button>
              </>
            )}
          </div>
        </div>

        {!isMainSheet && (
          <div className="px-4 py-2.5 bg-emerald-50/70 border-b border-emerald-100 flex items-center gap-2 text-xs text-emerald-900">
            <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
            <span>
              <b>Режим преподавателя 2-й подгруппы:</b> список ограничен вашей подгруппой ({visibleStudents.length} чел.). Колонки для лабораторных и практических работ появляются автоматически после их создания главным преподавателем.
            </span>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap border-collapse">
            <thead className="text-xs text-gray-700 uppercase bg-gray-100 border-b border-gray-300">
              <tr>
                <th rowSpan={2} className="px-3 py-3 font-semibold w-10 text-center border-r border-gray-300">
                  №
                </th>
                <th rowSpan={2} className="px-4 py-3 font-semibold sticky left-0 bg-gray-100 border-r border-gray-300 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] min-w-[210px]">
                  ФИО Учащегося
                </th>
                
                {lessons.map((lesson, lessonIdx) => {
                  const subOnly = isSubgroupLesson(lesson);
                  const hoursCount = lesson.hours === 1 ? 1 : 2;
                  const hasDetails = Boolean(lesson.topic || lesson.homework);

                  return (
                    <th 
                      key={lesson.id}
                      colSpan={hoursCount}
                      onClick={() => {
                        setSelectedLesson(lesson);
                        setIsModalOpen(true);
                      }}
                      title="Нажмите для просмотра темы и ДЗ"
                      className="px-2 py-2 text-center border-r border-b border-gray-300 cursor-pointer hover:bg-blue-100/60 transition-colors group/th select-none"
                    >
                      <div className="flex flex-col items-center gap-1 relative">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-400 font-bold">#{lessonIdx + 1}</span>
                          <span className="text-gray-800 font-bold group-hover/th:text-blue-700 underline decoration-dotted underline-offset-2">
                            {lesson.date}
                          </span>
                          {hasDetails && (
                            <BookOpen size={11} className="text-blue-500 shrink-0" />
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            subOnly ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {lesson.type}
                          </span>
                          <span className="text-[10px] text-gray-500 font-semibold lowercase">
                            ({hoursCount === 2 ? 'пара' : '1 ч.'})
                          </span>
                        </div>
                      </div>
                    </th>
                  );
                })}

                <th rowSpan={2} className="px-3 py-3 text-center border-l-2 border-r border-gray-300 bg-gray-100 font-bold text-gray-800 w-24">
                  Ср. балл
                </th>
                <th rowSpan={2} className="px-3 py-3 text-center bg-gray-100 font-bold text-gray-800 w-28">
                  Пропуски
                </th>
              </tr>

              <tr className="bg-gray-50 text-[10px] text-gray-500">
                {hourColumns.map(({ lesson, hourIndex, totalHours, isLastHourOfLesson }) => (
                  <th
                    key={`${lesson.id}-h${hourIndex}`}
                    className={`py-1 text-center font-semibold min-w-[44px] ${
                      isLastHourOfLesson ? 'border-r border-gray-300' : 'border-r border-dashed border-gray-300'
                    }`}
                  >
                    {totalHours === 2 ? `${hourIndex} ч.` : '1 ч.'}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {visibleStudents.map((student, idx) => {
                const { avg, absentHours } = getStudentStats(student);

                return (
                  <tr key={student.id} className="border-b border-gray-100 hover:bg-blue-50/30 transition-colors group/row">
                    <td className="px-3 py-2 text-center text-gray-500 border-r border-gray-200">{idx + 1}</td>
                    <td className="px-4 py-2 font-medium text-gray-900 sticky left-0 bg-white border-r border-gray-300 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] group-hover/row:bg-blue-50/30 transition-colors flex items-center justify-between gap-2">
                      <span>{student.fullName}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        student.subgroup === 1 ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {student.subgroup} п/г
                      </span>
                    </td>
                    
                    {hourColumns.map(({ lesson, hourIndex, isLastHourOfLesson }) => {
                      const locked = isCellLocked(student, lesson);
                      const isEditing =
                        !locked &&
                        editingCell?.studentId === student.id &&
                        editingCell?.lessonId === lesson.id &&
                        editingCell?.hourIndex === hourIndex;

                      const gradeObj = grades.find(
                        g =>
                          g.studentId === student.id &&
                          g.lessonId === lesson.id &&
                          (g.hourIndex || 1) === hourIndex
                      );
                      
                      let displayValue = '';
                      if (gradeObj) {
                        displayValue = gradeObj.attendance === 'ABSENT' ? 'Н' : gradeObj.grade;
                      }

                      const borderClass = isLastHourOfLesson
                        ? 'border-r border-gray-300'
                        : 'border-r border-dashed border-gray-200';

                      if (locked) {
                        return (
                          <td 
                            key={`${student.id}-${lesson.id}-h${hourIndex}`} 
                            title={
                              displayValue
                                ? `Оценка (${displayValue}) выставлена вторым преподавателем в листе 2-й подгруппы`
                                : 'Практическое/лабораторное занятие 2-й подгруппы (выставляет второй преподаватель)'
                            }
                            className={`p-0 ${borderClass} bg-gray-100/80 cursor-default select-none relative min-w-[44px]`}
                          >
                            {displayValue ? (
                              <div className={`w-full h-10 flex items-center justify-center text-sm ${
                                displayValue === 'Н' ? 'text-red-500 font-bold bg-red-50/40' : 'text-gray-800 font-bold'
                              }`}>
                                {displayValue}
                                <Lock size={9} className="absolute top-1 right-1 text-gray-400" />
                              </div>
                            ) : (
                              <div className="w-full h-10 flex items-center justify-center text-gray-300">
                                <span className="text-xs">—</span>
                              </div>
                            )}
                          </td>
                        );
                      }

                      return (
                        <td
                          key={`${student.id}-${lesson.id}-h${hourIndex}`}
                          className={`p-0 ${borderClass} relative min-w-[44px]`}
                        >
                          {isEditing ? (
                            <input
                              type="text"
                              autoFocus
                              maxLength={2}
                              defaultValue={displayValue}
                              onBlur={(e) => handleSaveGrade(student.id, lesson.id, hourIndex, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveGrade(student.id, lesson.id, hourIndex, e.target.value);
                                if (e.key === 'Escape') setEditingCell(null);
                              }}
                              className="w-full h-10 text-center text-sm font-bold outline-none ring-2 ring-blue-500 z-20 relative bg-white"
                            />
                          ) : (
                            <div
                              onClick={() => setEditingCell({ studentId: student.id, lessonId: lesson.id, hourIndex })}
                              className={`w-full h-10 flex items-center justify-center text-sm cursor-pointer transition-colors hover:bg-blue-100/50 ${
                                displayValue === 'Н' ? 'text-red-500 font-bold bg-red-50/30' : 'text-gray-800 font-medium'
                              }`}
                            >
                              {displayValue}
                            </div>
                          )}
                        </td>
                      );
                    })}

                    <td className="px-3 py-2 text-center border-l-2 border-r border-gray-300 bg-gray-50/50">
                      {avg ? (
                        <span className={`px-2 py-0.5 rounded text-xs ${getAvgBadgeStyle(avg)}`}>
                          {avg}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>

                    <td className="px-3 py-2 text-center bg-gray-50/50">
                      {absentHours > 0 ? (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-50 text-red-600 font-bold text-xs border border-red-200">
                          <span>{absentHours} Н</span>
                          <span className="text-[10px] font-normal text-red-500">({absentHours} ч.)</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">0</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Модуль сдачи ЛАБ/ПР теперь изолирован по subjectId */}
      {showWorksModule && (
        <WorkCompletionModule
          students={visibleStudents}
          isMainSheet={isMainSheet}
          subjectId={subjectId}
        />
      )}

      {showTopicsPanel && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
            <div className="flex items-center gap-2.5">
              <BookOpen className="text-blue-600" size={20} />
              <div>
                <h3 className="text-base font-bold text-gray-900">Учёт проведённых занятий, тем и домашних заданий</h3>
                <p className="text-xs text-gray-500">{subjectName}</p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-700 uppercase bg-gray-100 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2.5 w-14 text-center">№</th>
                  <th className="px-4 py-2.5 w-24 text-center">Дата</th>
                  <th className="px-4 py-2.5 w-28 text-center">Тип / Часы</th>
                  <th className="px-4 py-2.5">Тема занятия</th>
                  <th className="px-4 py-2.5">Домашнее задание</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lessons.map((lesson, idx) => (
                  <tr
                    key={lesson.id}
                    onClick={() => {
                      setSelectedLesson(lesson);
                      setIsModalOpen(true);
                    }}
                    className="hover:bg-blue-50/40 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 text-center text-gray-400 font-bold">#{idx + 1}</td>
                    <td className="px-4 py-3 text-center font-bold text-gray-900">{lesson.date}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-bold mr-1">
                        {lesson.type}
                      </span>
                      <span className="text-xs text-gray-500 font-medium">
                        ({lesson.hours === 1 ? '1 ч.' : '2 ч.'})
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {lesson.topic || <span className="text-gray-400 italic">Тема не заполнена</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {lesson.homework || <span className="text-gray-400 italic">Не задано</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AddLessonModal 
        isOpen={isModalOpen} 
        onClose={() => {
          setIsModalOpen(false);
          setSelectedLesson(null);
        }} 
        onAdd={handleAddLesson}
        onUpdate={handleUpdateLesson}
        onDelete={handleDeleteLesson}
        initialLesson={selectedLesson}
        existingLessons={lessons}
        canModify={isMainSheet}
      />

      <SubgroupManagerModal 
        isOpen={isSubgroupModalOpen}
        onClose={() => setIsSubgroupModalOpen(false)}
        students={students}
        onSave={setStudents}
      />
    </div>
  );
}