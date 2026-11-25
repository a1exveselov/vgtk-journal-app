import JournalDialog from '../ui/JournalDialog';
import { useState, useEffect } from 'react';
import { Check, AlertTriangle, X } from 'lucide-react';

const DEFAULT_SUBJECT_CONFIGS = {
  'subj-kp': { initialized: true, labsCount: 4, practicalsCount: 3 },
  'subj-db': { initialized: true, labsCount: 5, practicalsCount: 2 },
  'subj-web': { initialized: true, labsCount: 6, practicalsCount: 0 }
};

export default function WorkCompletionModule({ students, isMainSheet, subjectId = 'subj-kp' }) {
  const teacherSubgroup = isMainSheet ? 1 : 2;
  const [pendingForeignToggle, setPendingForeignToggle] = useState(null);

  const [allConfigs, setAllConfigs] = useState(() => {
    try {
      const saved = localStorage.getItem('vgtk_works_config_by_subject');
      return saved ? JSON.parse(saved) : DEFAULT_SUBJECT_CONFIGS;
    } catch {
      return DEFAULT_SUBJECT_CONFIGS;
    }
  });

  const [completions, setCompletions] = useState(() => {
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

  // Хранилище пометок о том, что сдача работы была выставлена не своей подгруппе
  const [crossSubgroupMarks, setCrossSubgroupMarks] = useState(() => {
    try {
      const saved = localStorage.getItem('vgtk_works_cross_marks');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const currentConfig = allConfigs[subjectId] || { initialized: true, labsCount: 3, practicalsCount: 2 };

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [draftLabs, setDraftLabs] = useState(currentConfig.labsCount);
  const [draftPracticals, setDraftPracticals] = useState(currentConfig.practicalsCount);

  useEffect(() => {
    localStorage.setItem('vgtk_works_config_by_subject', JSON.stringify(allConfigs));
  }, [allConfigs]);

  useEffect(() => {
    localStorage.setItem('vgtk_works_completion_by_subject', JSON.stringify(completions));
  }, [completions]);

  useEffect(() => {
    localStorage.setItem('vgtk_works_cross_marks', JSON.stringify(crossSubgroupMarks));
  }, [crossSubgroupMarks]);

  const labItems = Array.from({ length: Number(currentConfig.labsCount) || 0 }, (_, i) => ({
    id: `LAB_${i + 1}`,
    type: 'ЛАБ',
    num: i + 1,
    label: `ЛАБ №${i + 1}`
  }));

  const practicalItems = Array.from({ length: Number(currentConfig.practicalsCount) || 0 }, (_, i) => ({
    id: `PR_${i + 1}`,
    type: 'ПР',
    num: i + 1,
    label: `ПР №${i + 1}`
  }));

  const allWorks = [...labItems, ...practicalItems];

  const isForeignSubgroupStudent = (student) => {
    return Number(student.subgroup) !== Number(teacherSubgroup);
  };

  const executeToggleWork = (student, work, isForeign) => {
    const key = `${subjectId}_${student.id}_${work.id}`;
    const nextValue = !completions[key];

    setCompletions((prev) => ({
      ...prev,
      [key]: nextValue
    }));

    setCrossSubgroupMarks((prev) => {
      const updated = { ...prev };
      if (nextValue && isForeign) {
        updated[key] = {
          markedBySubgroup: teacherSubgroup,
          markedByRole: isMainSheet ? 'Преподаватель 1-й п/г' : 'Преподаватель 2-й п/г'
        };
      } else {
        delete updated[key];
      }
      return updated;
    });
  };

  const handleToggleWork = (student, work) => {
    if (isForeignSubgroupStudent(student)) {
      setPendingForeignToggle({ student, work });
      return;
    }
    executeToggleWork(student, work, false);
  };

  const handleConfirmForeignToggle = () => {
    if (!pendingForeignToggle) return;
    const { student, work } = pendingForeignToggle;
    setPendingForeignToggle(null);
    executeToggleWork(student, work, true);
  };

  const handleSaveConfig = (e) => {
    e.preventDefault();
    const lCount = Math.max(0, Math.min(25, Number(draftLabs) || 0));
    const pCount = Math.max(0, Math.min(25, Number(draftPracticals) || 0));
    setAllConfigs((prev) => ({
      ...prev,
      [subjectId]: {
        initialized: lCount > 0 || pCount > 0,
        labsCount: lCount,
        practicalsCount: pCount
      }
    }));
    setIsSettingsOpen(false);
  };

  return (
    <div className="bg-[var(--card)] rounded-sm border border-[var(--line)] overflow-hidden transition-colors duration-300">
      <div className="p-4 border-b border-[var(--line)] bg-[var(--soft)] flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div>
            <h3 className="text-base font-bold text-stone-900 dark:text-zinc-100">
              Сдача лабораторных и практических работ
            </h3>
            <p className="text-xs text-stone-600 dark:text-zinc-400">
              Лабораторных — {currentConfig.labsCount}, Практических — {currentConfig.practicalsCount} • Оба преподавателя видят всю группу
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setDraftLabs(currentConfig.labsCount);
            setDraftPracticals(currentConfig.practicalsCount);
            setIsSettingsOpen((prev) => !prev);
          }}
          className="flex items-center gap-2 px-3.5 py-2 bg-[#FAF8F5] dark:bg-[#181B20] border border-[#D8D1C5] dark:border-[#323844] hover:border-emerald-800 dark:hover:border-amber-400/50 text-stone-800 dark:text-zinc-200 text-xs font-bold rounded-sm transition-colors shadow-2xs cursor-pointer self-start sm:self-center"
        >
          <span>Настроить количество ЛАБ / ПР</span>
        </button>
      </div>

      {isSettingsOpen && (
        <form onSubmit={handleSaveConfig} className="p-4 bg-[#F4E8D4] dark:bg-[#22201B] border-b border-[var(--line)] flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-bold text-stone-800 dark:text-zinc-200 mb-1 flex items-center gap-1">
              <span>Количество лабораторных работ (ЛАБ)</span>
            </label>
            <input
              type="number"
              min={0}
              max={25}
              value={draftLabs}
              onChange={(e) => setDraftLabs(e.target.value)}
              className="w-36 px-3 py-1.5 text-sm font-bold bg-[#FAF8F5] dark:bg-[#181B20] text-stone-900 dark:text-zinc-100 border border-[#D8D1C5] dark:border-[#323844] rounded-lg focus:ring-2 focus:ring-emerald-700 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-800 dark:text-zinc-200 mb-1 flex items-center gap-1">
              <span>Количество практических работ (ПР)</span>
            </label>
            <input
              type="number"
              min={0}
              max={25}
              value={draftPracticals}
              onChange={(e) => setDraftPracticals(e.target.value)}
              className="w-36 px-3 py-1.5 text-sm font-bold bg-[#FAF8F5] dark:bg-[#181B20] text-stone-900 dark:text-zinc-100 border border-[#D8D1C5] dark:border-[#323844] rounded-lg focus:ring-2 focus:ring-emerald-700 outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="px-4 py-1.5 bg-[#244b3c] hover:bg-emerald-900 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer h-[34px]"
            >
              Сохранить для этого предмета
            </button>
            <button
              type="button"
              onClick={() => setIsSettingsOpen(false)}
              className="px-3 py-1.5 bg-[#FAF8F5] dark:bg-[#2A2F3A] border border-[#D8D1C5] dark:border-[#3A404D] hover:bg-[#EFECE6] text-stone-700 dark:text-zinc-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer h-[34px]"
            >
              Отмена
            </button>
          </div>
        </form>
      )}

      {allWorks.length === 0 ? (
        <div className="p-8 text-center space-y-3">
          <p className="text-sm text-stone-500 dark:text-zinc-400">
            Для этого предмета количество лабораторных и практических работ пока равно 0.
          </p>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#244b3c] text-white text-xs font-bold rounded-lg hover:bg-emerald-900 cursor-pointer"
          >
            <span>Задать количество работ</span>
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap border-collapse">
            <thead className="text-xs text-stone-800 dark:text-zinc-200 uppercase bg-[var(--soft)] border-b border-[#D8D1C5] dark:border-[#2E333D]">
              <tr>
                <th className="px-3 py-3 font-bold w-10 text-center border-r border-[#D8D1C5] dark:border-[#2E333D]">№</th>
                <th className="px-4 py-3 font-bold sticky left-0 bg-[var(--soft)] border-r border-[#D8D1C5] dark:border-[#2E333D] z-10 min-w-[220px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)]">
                  ФИО Учащегося
                </th>

                {allWorks.map((work) => (
                  <th
                    key={work.id}
                    className={`px-2.5 py-2.5 text-center border-r border-[#D8D1C5] dark:border-[#2E333D] min-w-[68px] ${
                      work.type === 'ЛАБ'
                        ? 'bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-300'
                        : 'bg-amber-50/80 dark:bg-amber-950/30 text-amber-950 dark:text-amber-300'
                    }`}
                  >
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] font-extrabold">{work.type}</span>
                      <span className="text-xs font-bold">№{work.num}</span>
                    </div>
                  </th>
                ))}

                <th className="px-4 py-3 text-center border-l-2 border-[#D8D1C5] dark:border-[#2E333D] bg-[var(--soft)] font-bold text-stone-900 dark:text-zinc-100 w-40">
                  Сдано работ
                </th>
              </tr>
            </thead>

            <tbody>
              {students.map((student, idx) => {
                const completedCount = allWorks.filter(
                  (w) => completions[`${subjectId}_${student.id}_${w.id}`]
                ).length;
                const totalWorks = allWorks.length;
                const progressPercent = totalWorks > 0 ? Math.round((completedCount / totalWorks) * 100) : 0;

                return (
                  <tr
                    key={student.id}
                    className="border-b border-[#EAE4DC] dark:border-[#262A32] hover:bg-[#F3EFE8] dark:hover:bg-[#22262E] transition-colors group/row"
                  >
                    <td className="px-3 py-2.5 text-center text-stone-500 dark:text-zinc-400 border-r border-[#EAE4DC] dark:border-[#262A32] group-hover/row:bg-[#F3EFE8] dark:group-hover/row:bg-[#22262E] transition-colors">
                      {idx + 1}
                    </td>

                    <td className="px-4 py-2.5 font-medium text-stone-900 dark:text-zinc-100 sticky left-0 bg-[var(--card)] group-hover/row:bg-[#F3EFE8] dark:group-hover/row:bg-[#22262E] border-r border-[#D8D1C5] dark:border-[#2E333D] z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] transition-colors">
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate">{student.fullName}</span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border shrink-0 shadow-2xs ${
                          student.subgroup === 1
                            ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-900 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30'
                            : 'bg-rose-100 dark:bg-rose-500/20 text-rose-900 dark:text-rose-300 border-rose-300 dark:border-rose-500/30'
                        }`}>
                          {student.subgroup} п/г
                        </span>
                      </div>
                    </td>

                    {allWorks.map((work) => {
                      const key = `${subjectId}_${student.id}_${work.id}`;
                      const isDone = Boolean(completions[key]);
                      const crossInfo = crossSubgroupMarks[key];

                      return (
                        <td
                          key={work.id}
                          onClick={() => handleToggleWork(student, work)}
                          title={
                            crossInfo
                              ? `Пометка: работа отмечена не своей подгруппе (${crossInfo.markedByRole})`
                              : `${student.fullName} — ${work.label}`
                          }
                          className={`p-1.5 text-center border-r border-[#EAE4DC] dark:border-[#262A32] select-none transition-colors cursor-pointer ${
                            crossInfo
                              ? 'bg-amber-100/50 dark:bg-amber-500/10 hover:bg-amber-200/50'
                              : 'hover:bg-amber-100/50 dark:hover:bg-amber-500/15'
                          }`}
                        >
                          <div className="inline-flex items-center justify-center relative">
                            <div
                              className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-all ${
                                isDone
                                  ? 'bg-emerald-700 border-emerald-800 text-amber-300 shadow-2xs'
                                  : 'bg-[#FAF8F5] dark:bg-[#22262E] border-[#C9BEA9] dark:border-[#3A404D] text-transparent hover:border-emerald-700 dark:hover:border-amber-400'
                              }`}
                            >
                              <Check size={14} strokeWidth={3} />
                            </div>

                            {crossInfo && isDone && (
                              <span className="absolute -top-1.5 -right-2 inline-flex items-center px-1 py-[1px] rounded bg-amber-400 text-stone-950 border border-amber-600/40 text-[8px] font-extrabold leading-none shadow-2xs">
                                !
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}

                    <td className="px-4 py-2.5 border-l-2 border-[#D8D1C5] dark:border-[#2E333D] bg-[#F5F2EC] dark:bg-[#1E2128] group-hover/row:bg-[#EFECE6] dark:group-hover/row:bg-[#22262E] transition-colors">
                      <div className="flex items-center justify-between text-xs font-bold mb-1">
                        <span className={completedCount === totalWorks ? 'text-emerald-800 dark:text-emerald-400' : 'text-stone-700 dark:text-zinc-300'}>
                          {completedCount} из {totalWorks}
                        </span>
                        <span className="text-[11px] text-stone-500 dark:text-zinc-400">{progressPercent}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-[#E2DCD3] dark:bg-[#2C313B] rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            progressPercent === 100
                              ? 'bg-emerald-700 dark:bg-emerald-500'
                              : progressPercent >= 50
                                ? 'bg-amber-500'
                                : 'bg-rose-600'
                          }`}
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Модальное окно подтверждения при отметке ЛАБ/ПР чужой подгруппе */}
      {pendingForeignToggle && (
        <JournalDialog titleId="confirm-work" onDismiss={() => setPendingForeignToggle(null)}>
        <div className="flex justify-between items-center p-5 border-b border-emerald-900 bg-[#23483c] text-white">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-400/20 text-amber-300 rounded-sm border border-amber-400/40">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 id="confirm-work" className="text-base font-bold text-white tracking-wide">
                    Чужая подгруппа ({pendingForeignToggle.work.label})
                  </h3>
                  <p className="text-xs text-emerald-200/80 mt-0.5">
                    Подтверждение отметки о сдаче работы
                  </p>
                </div>
              </div>

              <button
                onClick={() => setPendingForeignToggle(null)}
                aria-label="Закрыть"
                className="text-emerald-200/70 hover:text-amber-300 hover:bg-white/10 transition-colors rounded-sm p-1.5 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-4 rounded-sm bg-[#F4E8D4] dark:bg-[#1D1B16] border border-amber-400/70 dark:border-amber-500/40 text-xs text-stone-900 dark:text-zinc-200 space-y-1.5 leading-relaxed">
                <p>
                  Учащийся <b>{pendingForeignToggle.student.fullName}</b> относится к{' '}
                  <b>{pendingForeignToggle.student.subgroup}-й подгруппе</b>, а ваш активный лист —{' '}
                  <b>{teacherSubgroup}-я подгруппа</b>.
                </p>
                <p>
                  Работа: <b>{pendingForeignToggle.work.label}</b>.
                </p>
              </div>

              <p className="text-xs text-stone-600 dark:text-zinc-400 leading-relaxed">
                При подтверждении на чекбоксе появится золотая пометка <b>«!»</b> о том, что работу принял преподаватель другой подгруппы.
              </p>

              <div className="pt-3 border-t border-[#E2DCD3] dark:border-[#323844] flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setPendingForeignToggle(null)}
                  className="px-4 py-2 text-xs font-bold text-stone-800 dark:text-zinc-200 bg-[#EFECE6] dark:bg-[#2A2F3A] hover:bg-[#E2DCD3] dark:hover:bg-[#323846] border border-[#DED8CE] dark:border-[#3A404D] rounded-sm transition-colors cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleConfirmForeignToggle}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#244b3c] hover:bg-emerald-950 border border-amber-400/30 rounded-sm shadow-sm transition-colors cursor-pointer"
                >
                  <Check size={15} />
                  <span>Подтвердить</span>
                </button>
              </div>
            </div>
        </JournalDialog>
      )}
    </div>
  );
}
