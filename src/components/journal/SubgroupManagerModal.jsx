import JournalDialog from '../ui/JournalDialog';
import { useState } from 'react';
import { X, Check } from 'lucide-react';

export default function SubgroupManagerModal({ onClose, students = [], onSave }) {
  const [localStudents, setLocalStudents] = useState(students);

  const toggleSubgroup = (studentId) => {
    setLocalStudents((prev) =>
      prev.map((st) =>
        st.id === studentId
          ? { ...st, subgroup: st.subgroup === 1 ? 2 : 1 }
          : st
      )
    );
  };

  const subgroup1 = localStudents.filter((s) => s.subgroup === 1);
  const subgroup2 = localStudents.filter((s) => s.subgroup === 2);

  const handleSave = () => {
    onSave(localStudents);
    onClose();
  };

  return (
    <JournalDialog titleId="subgroups" onDismiss={onClose} wide>
        <div className="flex justify-between items-center p-5 border-b border-emerald-900 bg-[#23483c] text-white">
          <div className="flex items-center gap-3">
            <div>
              <h2 id="subgroups" className="text-base font-bold text-white tracking-wide">Управление подгруппами</h2>
              <p className="text-xs text-emerald-200/80 mt-0.5">
                Нажмите на учащегося для перевода между 1-й и 2-й подгруппами
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="text-emerald-200/70 hover:text-amber-300 hover:bg-white/10 transition-colors rounded-sm p-1.5 cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 1-я подгруппа */}
          <div className="rounded-sm border border-emerald-300/80 dark:border-emerald-500/30 bg-[#F3EFE8] dark:bg-[#181B20] overflow-hidden flex flex-col min-h-[280px]">
            <div className="px-4 py-3 bg-emerald-100/80 dark:bg-emerald-950/60 border-b border-emerald-300/80 dark:border-emerald-500/30 flex items-center justify-between">
              <span className="text-sm font-extrabold text-emerald-950 dark:text-emerald-200">1-я подгруппа</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-800 text-amber-300">
                {subgroup1.length} чел.
              </span>
            </div>

            <div className="divide-y divide-[#E2DCD3] dark:divide-[#262B34] flex-1">
              {subgroup1.map((student) => (
                <button
                  key={student.id}
                  onClick={() => toggleSubgroup(student.id)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-emerald-50/80 dark:hover:bg-emerald-950/30 transition-colors cursor-pointer group"
                >
                  <span className="text-sm font-medium text-stone-900 dark:text-zinc-100">{student.fullName}</span>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 dark:text-emerald-400 opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all">
                    <span>Во 2 п/г</span>
                  </span>
                </button>
              ))}
              {subgroup1.length === 0 && (
                <div className="p-6 text-center text-xs text-stone-400 dark:text-zinc-500 italic">
                  В 1-й подгруппе нет учащихся
                </div>
              )}
            </div>
          </div>

          {/* 2-я подгруппа */}
          <div className="rounded-sm border border-rose-300/80 dark:border-rose-500/30 bg-[#F3EFE8] dark:bg-[#181B20] overflow-hidden flex flex-col min-h-[280px]">
            <div className="px-4 py-3 bg-rose-100/80 dark:bg-rose-950/50 border-b border-rose-300/80 dark:border-rose-500/30 flex items-center justify-between">
              <span className="text-sm font-extrabold text-rose-950 dark:text-rose-200">2-я подгруппа</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-rose-800 text-amber-200">
                {subgroup2.length} чел.
              </span>
            </div>

            <div className="divide-y divide-[#E2DCD3] dark:divide-[#262B34] flex-1">
              {subgroup2.map((student) => (
                <button
                  key={student.id}
                  onClick={() => toggleSubgroup(student.id)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-rose-50/80 dark:hover:bg-rose-950/30 transition-colors cursor-pointer group"
                >
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-800 dark:text-rose-400 opacity-70 group-hover:opacity-100 group-hover:-translate-x-0.5 transition-all">
                    <span>В 1 п/г</span>
                  </span>
                  <span className="text-sm font-medium text-stone-900 dark:text-zinc-100 text-right">{student.fullName}</span>
                </button>
              ))}
              {subgroup2.length === 0 && (
                <div className="p-6 text-center text-xs text-stone-400 dark:text-zinc-500 italic">
                  Во 2-й подгруппе нет учащихся
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-[#E2DCD3] dark:border-[#323844] bg-[#EFECE6]/70 dark:bg-[#1C1F26] flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-stone-800 dark:text-zinc-200 bg-[#EFECE6] dark:bg-[#2A2F3A] hover:bg-[#E2DCD3] dark:hover:bg-[#323846] border border-[#DED8CE] dark:border-[#3A404D] rounded-sm transition-colors cursor-pointer"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#244b3c] hover:bg-emerald-950 border border-amber-400/30 rounded-sm shadow-sm transition-colors cursor-pointer"
          >
            <Check size={15} />
            <span>Сохранить списки</span>
          </button>
        </div>
    </JournalDialog>
  );
}
