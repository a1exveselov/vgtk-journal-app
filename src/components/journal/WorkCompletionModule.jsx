import React, { useState, useEffect } from 'react';
import { CheckSquare, Settings, Check, Lock, FlaskConical, Wrench, PlusCircle } from 'lucide-react';

// Начальные настройки количества работ по разным предметам
const DEFAULT_SUBJECT_CONFIGS = {
  'subj-kp': { initialized: true, labsCount: 4, practicalsCount: 3 },
  'subj-db': { initialized: true, labsCount: 5, practicalsCount: 2 },
  'subj-web': { initialized: true, labsCount: 6, practicalsCount: 0 }
};

export default function WorkCompletionModule({ students, isMainSheet, subjectId = 'subj-kp' }) {
  // Храним словарь конфигураций по всем предметам: { [subjectId]: { labsCount, practicalsCount } }
  const [allConfigs, setAllConfigs] = useState(() => {
    try {
      const saved = localStorage.getItem('vgtk_works_config_by_subject');
      return saved ? JSON.parse(saved) : DEFAULT_SUBJECT_CONFIGS;
    } catch {
      return DEFAULT_SUBJECT_CONFIGS;
    }
  });

  // Храним словарь галочек с префиксом subjectId: ключ `${subjectId}_${studentId}_LAB_${num}`
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

  const currentConfig = allConfigs[subjectId] || { initialized: true, labsCount: 3, practicalsCount: 2 };

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [draftLabs, setDraftLabs] = useState(currentConfig.labsCount);
  const [draftPracticals, setDraftPracticals] = useState(currentConfig.practicalsCount);

  // При смене предмета обновляем поля формы настроек
  useEffect(() => {
    const cfg = allConfigs[subjectId] || { labsCount: 3, practicalsCount: 2 };
    setDraftLabs(cfg.labsCount);
    setDraftPracticals(cfg.practicalsCount);
    setIsSettingsOpen(false);
  }, [subjectId, allConfigs]);

  useEffect(() => {
    localStorage.setItem('vgtk_works_config_by_subject', JSON.stringify(allConfigs));
  }, [allConfigs]);

  useEffect(() => {
    localStorage.setItem('vgtk_works_completion_by_subject', JSON.stringify(completions));
  }, [completions]);

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

  const canToggleStudentWork = (student) => {
    if (isMainSheet) {
      return student.subgroup === 1;
    } else {
      return student.subgroup === 2;
    }
  };

  const handleToggleWork = (student, workId) => {
    if (!canToggleStudentWork(student)) return;
    const key = `${subjectId}_${student.id}_${workId}`;
    setCompletions(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSaveConfig = (e) => {
    e.preventDefault();
    const lCount = Math.max(0, Math.min(25, Number(draftLabs) || 0));
    const pCount = Math.max(0, Math.min(25, Number(draftPracticals) || 0));
    setAllConfigs(prev => ({
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
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
            <CheckSquare size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">
              Модуль учёта сданных лабораторных и практических работ
            </h3>
            <p className="text-xs text-gray-500">
              {isMainSheet
                ? `По данному предмету: Лабораторных — ${currentConfig.labsCount}, Практических — ${currentConfig.practicalsCount}`
                : `Ведомость 2-й подгруппы (Лабораторных — ${currentConfig.labsCount}, Практических — ${currentConfig.practicalsCount})`}
            </p>
          </div>
        </div>

        {isMainSheet && (
          <button
            onClick={() => {
              setDraftLabs(currentConfig.labsCount);
              setDraftPracticals(currentConfig.practicalsCount);
              setIsSettingsOpen(prev => !prev);
            }}
            className="flex items-center gap-2 px-3.5 py-2 bg-white border border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-gray-700 text-xs font-bold rounded-lg transition-colors shadow-2xs cursor-pointer self-start sm:self-center"
          >
            <Settings size={15} className="text-blue-600" />
            <span>Настроить количество ЛАБ / ПР</span>
          </button>
        )}
      </div>

      {isMainSheet && isSettingsOpen && (
        <form onSubmit={handleSaveConfig} className="p-4 bg-blue-50/50 border-b border-blue-100 flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
              <FlaskConical size={13} className="text-indigo-600" />
              <span>Количество лабораторных работ (ЛАБ)</span>
            </label>
            <input
              type="number"
              min={0}
              max={25}
              value={draftLabs}
              onChange={(e) => setDraftLabs(e.target.value)}
              className="w-36 px-3 py-1.5 text-sm font-bold bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
              <Wrench size={13} className="text-amber-600" />
              <span>Количество практических работ (ПР)</span>
            </label>
            <input
              type="number"
              min={0}
              max={25}
              value={draftPracticals}
              onChange={(e) => setDraftPracticals(e.target.value)}
              className="w-36 px-3 py-1.5 text-sm font-bold bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer h-[34px]"
            >
              Сохранить для этого предмета
            </button>
            <button
              type="button"
              onClick={() => setIsSettingsOpen(false)}
              className="px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer h-[34px]"
            >
              Отмена
            </button>
          </div>
        </form>
      )}

      {allWorks.length === 0 ? (
        <div className="p-8 text-center space-y-3">
          <p className="text-sm text-gray-500">
            Для этого предмета количество лабораторных и практических работ пока равно 0.
          </p>
          {isMainSheet && (
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 cursor-pointer"
            >
              <PlusCircle size={15} />
              <span>Задать количество работ</span>
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap border-collapse">
            <thead className="text-xs text-gray-700 uppercase bg-gray-100 border-b border-gray-300">
              <tr>
                <th className="px-3 py-3 font-semibold w-10 text-center border-r border-gray-300">№</th>
                <th className="px-4 py-3 font-semibold sticky left-0 bg-gray-100 border-r border-gray-300 z-10 min-w-[210px]">
                  ФИО Учащегося
                </th>

                {allWorks.map((work) => (
                  <th
                    key={work.id}
                    className={`px-2.5 py-2.5 text-center border-r border-gray-200 min-w-[68px] ${
                      work.type === 'ЛАБ' ? 'bg-indigo-50/60 text-indigo-900' : 'bg-amber-50/60 text-amber-900'
                    }`}
                  >
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] font-extrabold">{work.type}</span>
                      <span className="text-xs font-bold">№{work.num}</span>
                    </div>
                  </th>
                ))}

                <th className="px-4 py-3 text-center border-l-2 border-gray-300 bg-gray-100 font-bold text-gray-800 w-40">
                  Сдано работ
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {students.map((student, idx) => {
                const canEdit = canToggleStudentWork(student);
                const completedCount = allWorks.filter(
                  w => completions[`${subjectId}_${student.id}_${w.id}`]
                ).length;
                const totalWorks = allWorks.length;
                const progressPercent = totalWorks > 0 ? Math.round((completedCount / totalWorks) * 100) : 0;

                return (
                  <tr key={student.id} className="hover:bg-blue-50/20 transition-colors">
                    <td className="px-3 py-2.5 text-center text-gray-500 border-r border-gray-200">{idx + 1}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-900 sticky left-0 bg-white border-r border-gray-300 z-10 flex items-center justify-between gap-2">
                      <span>{student.fullName}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        student.subgroup === 1 ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {student.subgroup} п/г
                      </span>
                    </td>

                    {allWorks.map((work) => {
                      const isDone = Boolean(completions[`${subjectId}_${student.id}_${work.id}`]);

                      return (
                        <td
                          key={work.id}
                          onClick={() => handleToggleWork(student, work.id)}
                          className={`p-1.5 text-center border-r border-gray-200 select-none transition-colors ${
                            canEdit
                              ? 'cursor-pointer hover:bg-emerald-50/60'
                              : 'bg-gray-50/80 cursor-default'
                          }`}
                        >
                          <div className="flex items-center justify-center relative">
                            <div
                              className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-all ${
                                isDone
                                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-2xs'
                                  : canEdit
                                    ? 'bg-white border-gray-300 text-transparent hover:border-emerald-400'
                                    : 'bg-gray-100 border-gray-200 text-transparent'
                              }`}
                            >
                              <Check size={15} strokeWidth={3} />
                            </div>
                            {!canEdit && (
                              <Lock size={9} className="absolute -top-0.5 -right-0.5 text-gray-400" />
                            )}
                          </div>
                        </td>
                      );
                    })}

                    <td className="px-4 py-2.5 border-l-2 border-gray-300 bg-gray-50/40">
                      <div className="flex items-center justify-between text-xs font-bold mb-1">
                        <span className={completedCount === totalWorks ? 'text-emerald-700' : 'text-gray-700'}>
                          {completedCount} из {totalWorks}
                        </span>
                        <span className="text-[11px] text-gray-400">{progressPercent}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            progressPercent === 100
                              ? 'bg-emerald-500'
                              : progressPercent >= 50
                                ? 'bg-blue-500'
                                : 'bg-amber-500'
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
    </div>
  );
}