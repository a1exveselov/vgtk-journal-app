import { getGradeHourIndex } from '../../data/journalRepository';
import JournalDialog from '../ui/JournalDialog';
import { useState } from 'react';
import { AlertTriangle, X, Check } from 'lucide-react';
import AddLessonModal from './AddLessonModal';
import { getLessonTimestamp } from './lessonDate';
import SubgroupManagerModal from './SubgroupManagerModal';
import WorkCompletionModule from './WorkCompletionModule';

export default function JournalTable({ snapshot, save }) {
  const { subjectName, isMain: isMainSheet } = snapshot.sheet;
  const [gradeFailure, setGradeFailure] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [isSubgroupModalOpen, setIsSubgroupModalOpen] = useState(false);
  const [showTopicsPanel, setShowTopicsPanel] = useState(true);
  const [showWorksModule, setShowWorksModule] = useState(true);

  // Предупреждение при попытке выставить оценку чужой подгруппе
  const [crossSubgroupWarning, setCrossSubgroupWarning] = useState(null);

  // Своя подгруппа текущего преподавателя: 1 — для главного, 2 — для второго преподавателя
  const teacherSubgroup = isMainSheet ? 1 : 2;
  const teacherRoleLabel = isMainSheet
    ? 'Преподаватель 1-й подгруппы (Главный)'
    : 'Преподаватель 2-й подгруппы';

  const [editingCell, setEditingCell] = useState(null);
  const displayed = editingCell?.base ?? snapshot;
  const { students, grades } = displayed;
  const isSubgroupLesson = (lesson) => {
    return lesson.type === 'ПР' || lesson.type === 'ЛАБ' || lesson.isSubgroupOnly;
  };

  // Оба преподавателя видят все занятия предмета и весь список группы
  const lessons = [...displayed.lessons].sort((a, b) => getLessonTimestamp(a) - getLessonTimestamp(b));
  const visibleStudents = students;

  const handleAddLesson = (fields, base) =>
    save(base, { type: 'addLesson', lessonId: `l${Date.now()}`, fields });
  const handleUpdateLesson = (fields, base) =>
    save(base, { type: 'updateLesson', lessonId: selectedLesson.id, fields });
  const handleDeleteLesson = (lessonId, base) => save(base, { type: 'deleteLesson', lessonId });

  // Проверка: относится ли учащийся к чужой подгруппе для текущего преподавателя
  const isForeignSubgroupStudent = (student) => {
    return Number(student.subgroup) !== Number(teacherSubgroup);
  };

  // Клик по ячейке оценки
  const handleCellClick = (student, lesson, hourIndex) => {
    if (isForeignSubgroupStudent(student)) {
      setCrossSubgroupWarning({
        base: snapshot,
        student,
        lesson,
        hourIndex
      });
      return;
    }

    setEditingCell({
      studentId: student.id,
      lessonId: lesson.id,
      hourIndex,
      base: snapshot, isCrossSubgroup: false
    });
  };

  // Подтверждение в модальном окне предупреждения
  const handleConfirmCrossSubgroupEdit = () => {
    if (!crossSubgroupWarning) return;
    const { student, lesson, hourIndex } = crossSubgroupWarning;
    setCrossSubgroupWarning(null);
    setEditingCell({
      studentId: student.id,
      lessonId: lesson.id,
      hourIndex,
      base: crossSubgroupWarning.base, isCrossSubgroup: true
    });
  };

  // Сохранение оценки с фиксацией пометки, если это чужая подгруппа
  const handleSaveGrade = (student, lessonId, hourIndex, value) => {
    const cleanValue = value.trim().toUpperCase();
    const isCross = editingCell.isCrossSubgroup;
    const absent = cleanValue === 'Н';
    const command = { type: 'setGrade', studentId: student.id, lessonId, hourIndex,
      value: cleanValue ? { grade: absent ? null : cleanValue, attendance: absent ? 'ABSENT' : 'PRESENT',
        isCrossSubgroup: isCross, markedBySubgroup: teacherSubgroup, markedByRole: teacherRoleLabel } : null };
    const result = save(editingCell.base, command);
    setGradeFailure(result.ok ? null : { message: result.error.message, command, text: cleanValue });
    setEditingCell(null);
  };

  const savedGrade = gradeFailure && snapshot.grades.find(g =>
    g.studentId === gradeFailure.command.studentId && g.lessonId === gradeFailure.command.lessonId &&
    getGradeHourIndex(g) === gradeFailure.command.hourIndex);

  const hourColumns = lessons.flatMap((lesson) => {
    const count = lesson.hours === 1 ? 1 : 2;
    return Array.from({ length: count }, (_, idx) => ({
      lesson,
      hourIndex: idx + 1,
      totalHours: count,
      isLastHourOfLesson: idx + 1 === count
    }));
  });

  const getStudentStats = (student) => {
    const sheetLessonIds = lessons.map((lesson) => lesson.id);

    const studentGrades = grades.filter(
      (g) => g.studentId === student.id && sheetLessonIds.includes(g.lessonId)
    );

    const numericGrades = studentGrades
      .filter((g) => g.attendance !== 'ABSENT' && g.grade !== null && g.grade !== '')
      .map((g) => Number(g.grade))
      .filter((val) => !isNaN(val));

    const avg = numericGrades.length > 0
      ? (numericGrades.reduce((sum, val) => sum + val, 0) / numericGrades.length).toFixed(2)
      : null;

    const absentHours = studentGrades.filter((g) => g.attendance === 'ABSENT').length;

    return { avg, absentHours };
  };

  const getAvgBadgeStyle = (avg) => {
    if (!avg) return 'text-stone-400 dark:text-zinc-500';
    const num = parseFloat(avg);
    if (num >= 8) return 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-900 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 font-extrabold';
    if (num >= 5) return 'bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30 font-bold';
    if (num >= 4) return 'bg-orange-100 dark:bg-orange-500/20 text-orange-800 dark:text-orange-300 border border-orange-300 dark:border-orange-500/30 font-bold';
    return 'bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-500/30 font-bold';
  };

  return (
    <div className="space-y-6">
      {gradeFailure && <div role="alert">{gradeFailure.message} Черновик отметки: {gradeFailure.text || 'очистить'}.
        Сейчас в журнале: {savedGrade?.attendance === 'ABSENT' ? 'Н' : savedGrade?.grade ?? 'пусто'}.
        <button onClick={() => {
          const { command } = gradeFailure;
          const student = students.find(s => s.id === command.studentId);
          const lesson = lessons.find(l => l.id === command.lessonId);
          if (student && lesson && command.hourIndex <= lesson.hours) {
            handleCellClick(student, lesson, command.hourIndex);
          }
        }}>Открыть ячейку для сверки</button>
        <button onClick={() => setGradeFailure(null)}>Отменить черновик</button>
      </div>}
      <header className="sheet-heading">
        <p className="section-kicker">Группа {snapshot.group.name} · {isMainSheet ? 'Основной лист' : '2-я подгруппа'}</p>
        <h1>{subjectName}</h1>
        <div className="sheet-tools">
          <button aria-pressed={showWorksModule} onClick={() => setShowWorksModule((open) => !open)}>Сдача работ</button>
          <button aria-pressed={showTopicsPanel} onClick={() => setShowTopicsPanel((open) => !open)}>Темы и задания</button>
          <button onClick={() => setIsSubgroupModalOpen(true)}>Подгруппы</button>
          <button className="primary" onClick={() => { setSelectedLesson(null); setIsModalOpen(true); }}>Добавить занятие</button>
        </div>
      </header>
      <div className="register-panel overflow-hidden pb-4">
        {/* Информационная строка с легендой пометки */}
        <div className="px-5 py-2.5 bg-[#F4E8D4]/70 dark:bg-[#22201B] border-b border-[var(--line)] flex flex-wrap items-center justify-between gap-3 text-xs text-stone-800 dark:text-zinc-300">
          <div className="flex items-center gap-2">
            <span>
              Ваша подгруппа — <b>{teacherSubgroup}-я</b>.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-400/25 dark:bg-amber-500/20 border border-amber-500/50 text-amber-950 dark:text-amber-300 font-bold text-[11px]">
              <AlertTriangle size={11} className="text-amber-700 dark:text-amber-400" />
              <span>Чужая п/г</span>
            </span>
            <span className="text-stone-600 dark:text-zinc-400">
              — пометка об оценке, выставленной не своей подгруппе
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap border-collapse">
            <thead className="text-xs text-stone-800 dark:text-zinc-200 uppercase bg-[var(--soft)] border-b border-[#D8D1C5] dark:border-[#2E333D]">
              <tr>
                <th rowSpan={2} className="px-3 py-3 font-bold w-10 text-center border-r border-[#D8D1C5] dark:border-[#2E333D]">
                  №
                </th>
                <th rowSpan={2} className="px-4 py-3 font-bold sticky left-0 bg-[var(--soft)] border-r border-[#D8D1C5] dark:border-[#2E333D] z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] min-w-[220px]">
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
                      title="Нажмите для просмотра темы и ДЗ"
                      className="px-2 py-2 text-center border-r border-b border-[#D8D1C5] dark:border-[#2E333D] cursor-pointer hover:bg-[#E5DFD3] dark:hover:bg-[#2A2F3A] transition-colors group/th select-none"
                    >
                      <button className="w-full flex flex-col items-center gap-1 relative cursor-pointer"
                        aria-label={`Занятие ${lesson.date}, ${lesson.type}`}
                        onClick={() => { setSelectedLesson(lesson); setIsModalOpen(true); }}>
                        <span className="flex items-center gap-1">
                          <span className="text-[10px] text-stone-500 dark:text-zinc-400 font-bold">#{lessonIdx + 1}</span>
                          <span className="text-stone-900 dark:text-zinc-100 font-extrabold group-hover/th:text-emerald-900 dark:group-hover/th:text-amber-300 underline decoration-dotted underline-offset-2">
                            {lesson.date}
                          </span>
                          {hasDetails && <span title="Заполнены тема или задание" aria-label="Заполнены тема или задание">·</span>}
                        </span>

                        <span className="flex items-center gap-1">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                            subOnly
                              ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-500/30'
                              : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-900 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30'
                          }`}>
                            {lesson.type}
                          </span>
                          <span className="text-[10px] text-stone-600 dark:text-zinc-400 font-semibold lowercase">
                            ({hoursCount === 2 ? 'пара' : '1 ч.'})
                          </span>
                        </span>
                      </button>
                    </th>
                  );
                })}

                <th rowSpan={2} className="px-3 py-3 text-center border-l-2 border-r border-[#D8D1C5] dark:border-[#2E333D] bg-[var(--soft)] font-bold text-stone-900 dark:text-zinc-100 w-24">
                  Ср. балл
                </th>
                <th rowSpan={2} className="px-3 py-3 text-center bg-[var(--soft)] font-bold text-stone-900 dark:text-zinc-100 w-28">
                  Пропуски
                </th>
              </tr>

              <tr className="bg-[#F5F2EC] dark:bg-[#1E2128] text-[10px] text-stone-600 dark:text-zinc-400">
                {hourColumns.map(({ lesson, hourIndex, totalHours, isLastHourOfLesson }) => (
                  <th
                    key={`${lesson.id}-h${hourIndex}`}
                    className={`py-1 text-center font-bold min-w-[48px] ${
                      isLastHourOfLesson ? 'border-r border-[#D8D1C5] dark:border-[#2E333D]' : 'border-r border-dashed border-[#D8D1C5] dark:border-[#2E333D]'
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
                const isOtherSubgroup = isForeignSubgroupStudent(student);

                return (
                  <tr
                    key={student.id}
                    className="border-b border-[#EAE4DC] dark:border-[#262A32] hover:bg-[#F3EFE8] dark:hover:bg-[#22262E] transition-colors group/row"
                  >
                    <td className="px-3 py-2 text-center text-stone-500 dark:text-zinc-400 border-r border-[#EAE4DC] dark:border-[#262A32]">
                      {idx + 1}
                    </td>
                    <td className="px-4 py-2 font-medium text-stone-900 dark:text-zinc-100 sticky left-0 bg-[var(--card)] group-hover/row:bg-[#F3EFE8] dark:group-hover/row:bg-[#22262E] border-r border-[#D8D1C5] dark:border-[#2E333D] z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate">{student.fullName}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border shrink-0 ${
                          student.subgroup === 1
                            ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-900 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30'
                            : 'bg-rose-100 dark:bg-rose-500/20 text-rose-900 dark:text-rose-300 border-rose-300 dark:border-rose-500/30'
                        }`}>
                          {student.subgroup} п/г
                        </span>
                      </div>
                    </td>

                    {hourColumns.map(({ lesson, hourIndex, isLastHourOfLesson }) => {
                      const isEditing =
                        editingCell?.studentId === student.id &&
                        editingCell?.lessonId === lesson.id &&
                        editingCell?.hourIndex === hourIndex;

                      const gradeObj = grades.find(
                        (g) =>
                          g.studentId === student.id &&
                          g.lessonId === lesson.id &&
                          getGradeHourIndex(g) === hourIndex
                      );

                      let displayValue = '';
                      if (gradeObj) {
                        displayValue = gradeObj.attendance === 'ABSENT' ? 'Н' : gradeObj.grade;
                      }

                      const hasCrossMarker = Boolean(gradeObj?.isCrossSubgroup);

                      const borderClass = isLastHourOfLesson
                        ? 'border-r border-[#D8D1C5] dark:border-[#2E333D]'
                        : 'border-r border-dashed border-[#E5DFD5] dark:border-[#262A32]';

                      const cellTooltip = hasCrossMarker
                        ? `Пометка: отметка «${displayValue}» выставлена не своей подгруппе (${gradeObj?.markedByRole || 'другим преподавателем'})`
                        : isOtherSubgroup
                          ? `Учащийся ${student.subgroup}-й подгруппы (нажмите для выставления отметки с подтверждением)`
                          : undefined;

                      return (
                        <td
                          key={`${student.id}-${lesson.id}-h${hourIndex}`}
                          title={cellTooltip}
                          className={`p-0 ${borderClass} relative min-w-[48px]`}
                        >
                          {isEditing ? (
                            <input
                              type="text"
                              aria-label="Отметка"
                              autoFocus
                              maxLength={2}
                              defaultValue={gradeFailure?.command.studentId === student.id && gradeFailure.command.lessonId === lesson.id &&
                                gradeFailure.command.hourIndex === hourIndex ? gradeFailure.text : displayValue}
                              onBlur={(e) => handleSaveGrade(student, lesson.id, hourIndex, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') e.currentTarget.blur();
                                if (e.key === 'Escape') setEditingCell(null);
                              }}
                              className="w-full h-10 text-center text-sm font-bold outline-none ring-2 ring-emerald-700 dark:ring-amber-400 z-20 relative bg-[#FAF8F5] dark:bg-[#262B34] text-stone-900 dark:text-zinc-100"
                            />
                          ) : (
                            <button
                              aria-label={`${student.fullName}, ${lesson.date}, час ${hourIndex}: ${displayValue || 'нет отметки'}`}
                              onClick={() => handleCellClick(student, lesson, hourIndex)}
                              className={`w-full h-10 flex items-center justify-center text-sm cursor-pointer transition-colors relative ${
                                hasCrossMarker
                                  ? 'bg-amber-100/55 dark:bg-amber-500/15 hover:bg-amber-200/60 dark:hover:bg-amber-500/25'
                                  : 'hover:bg-amber-100/50 dark:hover:bg-amber-500/15'
                              } ${
                                displayValue === 'Н'
                                  ? 'text-rose-700 dark:text-rose-400 font-extrabold'
                                  : 'text-stone-900 dark:text-zinc-100 font-semibold'
                              }`}
                            >
                              <span>{displayValue}</span>

                              {/* Пометка о том, что оценка выставлена не своей подгруппе */}
                              {hasCrossMarker && displayValue && (
                                <span
                                  className="absolute top-0.5 right-0.5 inline-flex items-center gap-0.5 px-1 py-[1px] rounded bg-amber-400 text-stone-950 text-[8px] font-extrabold leading-none shadow-2xs border border-amber-600/30"
                                >
                                  <AlertTriangle size={8} strokeWidth={2.5} />
                                  <span>{gradeObj.markedBySubgroup ? `${gradeObj.markedBySubgroup}п/г` : '!'}</span>
                                </span>
                              )}
                            </button>
                          )}
                        </td>
                      );
                    })}

                    <td className="px-3 py-2 text-center border-l-2 border-r border-[#D8D1C5] dark:border-[#2E333D] bg-[#F5F2EC] dark:bg-[#1E2128]">
                      {avg ? (
                        <span className={`px-2 py-0.5 rounded text-xs ${getAvgBadgeStyle(avg)}`}>
                          {avg}
                        </span>
                      ) : (
                        <span className="text-stone-400 dark:text-zinc-500 text-xs">—</span>
                      )}
                    </td>

                    <td className="px-3 py-2 text-center bg-[#F5F2EC] dark:bg-[#1E2128]">
                      {absentHours > 0 ? (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-500/15 text-rose-800 dark:text-rose-300 font-bold text-xs border border-rose-200 dark:border-rose-500/30">
                          <span>{absentHours} Н</span>
                          <span className="text-[10px] font-normal text-rose-600 dark:text-rose-400">({absentHours} ч.)</span>
                        </div>
                      ) : (
                        <span className="text-stone-400 dark:text-zinc-500 text-xs">0</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Модуль сдачи ЛАБ/ПР: теперь тоже показывает всех учащихся и предупреждает о чужой подгруппе */}
      {showWorksModule && (
        <WorkCompletionModule
          students={visibleStudents}
          isMainSheet={isMainSheet}
          snapshot={snapshot}
          save={save}
        />
      )}

      {showTopicsPanel && (
        <div className="bg-[var(--card)] rounded-sm border border-[var(--line)] overflow-hidden transition-colors duration-300">
          <div className="p-4 border-b border-[var(--line)] bg-[var(--soft)] flex justify-between items-center">
            <div className="flex items-center gap-2.5">
              <div>
                <h3 className="text-base font-bold text-stone-900 dark:text-zinc-100">Учёт проведённых занятий, тем и домашних заданий</h3>
                <p className="text-xs text-stone-600 dark:text-zinc-400">{subjectName}</p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-stone-700 dark:text-zinc-300 uppercase bg-[#F5F2EC] dark:bg-[#1E2128] border-b border-[var(--line)]">
                <tr>
                  <th className="px-4 py-2.5 w-14 text-center">№</th>
                  <th className="px-4 py-2.5 w-24 text-center">Дата</th>
                  <th className="px-4 py-2.5 w-28 text-center">Тип / Часы</th>
                  <th className="px-4 py-2.5">Тема занятия</th>
                  <th className="px-4 py-2.5">Домашнее задание</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE4DC] dark:divide-[#262A32]">
                {lessons.map((lesson, idx) => (
                  <tr
                    key={lesson.id}
                    onClick={() => {
                      setSelectedLesson(lesson);
                      setIsModalOpen(true);
                    }}
                    className="hover:bg-[#F3EFE8] dark:hover:bg-[#22262E] transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 text-center text-stone-500 dark:text-zinc-400 font-bold">#{idx + 1}</td>
                    <td className="px-4 py-3 text-center font-bold text-stone-900 dark:text-zinc-100">{lesson.date}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-900 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 rounded text-xs font-bold mr-1">
                        {lesson.type}
                      </span>
                      <span className="text-xs text-stone-600 dark:text-zinc-400 font-medium">
                        ({lesson.hours === 1 ? '1 ч.' : '2 ч.'})
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-stone-800 dark:text-zinc-200">
                      {lesson.topic || <span className="text-stone-400 dark:text-zinc-500 italic">Тема не заполнена</span>}
                    </td>
                    <td className="px-4 py-3 text-stone-600 dark:text-zinc-300">
                      {lesson.homework || <span className="text-stone-400 dark:text-zinc-500 italic">Не задано</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Модальное окно предупреждения о выставлении отметки не своей подгруппе */}
      {crossSubgroupWarning && (
        <JournalDialog titleId="confirm-grade" onDismiss={() => setCrossSubgroupWarning(null)}>
        <div className="flex justify-between items-center p-5 border-b border-emerald-900 bg-[#23483c] text-white">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-400/20 text-amber-300 rounded-sm border border-amber-400/40">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 id="confirm-grade" className="text-base font-bold text-white tracking-wide">
                    Чужая подгруппа
                  </h3>
                  <p className="text-xs text-emerald-200/80 mt-0.5">
                    Подтверждение выставления отметки
                  </p>
                </div>
              </div>

              <button
                onClick={() => setCrossSubgroupWarning(null)}
                aria-label="Закрыть"
                className="text-emerald-200/70 hover:text-amber-300 hover:bg-white/10 transition-colors rounded-sm p-1.5 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-4 rounded-sm bg-[#F4E8D4] dark:bg-[#1D1B16] border border-amber-400/70 dark:border-amber-500/40 text-xs text-stone-900 dark:text-zinc-200 space-y-2 leading-relaxed">
                <p>
                  Учащийся <b>{crossSubgroupWarning.student.fullName}</b> числится во{' '}
                  <b>{crossSubgroupWarning.student.subgroup}-й подгруппе</b>, а вы работаете в режиме{' '}
                  <b>{teacherSubgroup}-й подгруппы</b>.
                </p>
                <p className="text-stone-700 dark:text-amber-200/90">
                  Занятие: <b>{crossSubgroupWarning.lesson.date} ({crossSubgroupWarning.lesson.type})</b>,{' '}
                  {crossSubgroupWarning.hourIndex}-й час.
                </p>
              </div>

              <p className="text-xs text-stone-600 dark:text-zinc-400 leading-relaxed">
                Если вы оставите отметку в этой ячейке, рядом с ней автоматически появится специальная пометка{' '}
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-400 text-stone-950 font-extrabold text-[10px]">
                  ! {teacherSubgroup}п/г
                </span>{' '}
                о том, что оценка выставлена преподавателем другой подгруппы.
              </p>

              <div className="pt-3 border-t border-[#E2DCD3] dark:border-[#323844] flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setCrossSubgroupWarning(null)}
                  className="px-4 py-2 text-xs font-bold text-stone-800 dark:text-zinc-200 bg-[#EFECE6] dark:bg-[#2A2F3A] hover:bg-[#E2DCD3] dark:hover:bg-[#323846] border border-[#DED8CE] dark:border-[#3A404D] rounded-sm transition-colors cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCrossSubgroupEdit}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#244b3c] hover:bg-emerald-950 border border-amber-400/30 rounded-sm shadow-sm transition-colors cursor-pointer"
                >
                  <Check size={15} />
                  <span>Продолжить и выставить</span>
                </button>
              </div>
            </div>
        </JournalDialog>
      )}

      {isModalOpen && <AddLessonModal
        onClose={() => {
          setIsModalOpen(false);
          setSelectedLesson(null);
        }}
        snapshot={snapshot}
        onAdd={handleAddLesson}
        onUpdate={handleUpdateLesson}
        onDelete={handleDeleteLesson}
        initialLesson={selectedLesson}
        existingLessons={lessons}
        canModify={true}
      />}

      {isSubgroupModalOpen && <SubgroupManagerModal
        onClose={() => setIsSubgroupModalOpen(false)}
        students={students}
        snapshot={snapshot}
        onSave={(updates, base) => save(base, { type: 'setSubgroups', updates })}
      />}
    </div>
  );
}
