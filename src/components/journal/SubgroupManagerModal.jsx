import React, { useState, useEffect } from 'react';
import { X, ArrowRight, ArrowLeft, Users } from 'lucide-react';

export default function SubgroupManagerModal({ isOpen, onClose, students, onSave }) {
  const [localStudents, setLocalStudents] = useState([]);

  // Загружаем текущих студентов при открытии окна
  useEffect(() => {
    if (isOpen) {
      setLocalStudents([...students]);
    }
  }, [isOpen, students]);

  if (!isOpen) return null;

  // Функция переноса студента в другую подгруппу
  const moveTo = (studentId, targetGroup) => {
    setLocalStudents(prev => 
      prev.map(s => s.id === studentId ? { ...s, subgroup: targetGroup } : s)
    );
  };

  const handleSave = () => {
    onSave(localStudents);
    onClose();
  };

  const sub1 = localStudents.filter(s => s.subgroup === 1);
  const sub2 = localStudents.filter(s => s.subgroup === 2);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Шапка */}
        <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
              <Users size={20} />
            </div>
            <h2 className="text-lg font-bold text-gray-800">Управление подгруппами</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors rounded-full p-1 hover:bg-red-50">
            <X size={20} />
          </button>
        </div>

        {/* Списки подгрупп */}
        <div className="p-6 flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50/50">
          
          {/* Колонка: Подгруппа 1 */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm flex flex-col h-[50vh]">
            <div className="bg-blue-50 border-b border-blue-100 px-4 py-3 flex justify-between items-center">
              <h3 className="font-semibold text-blue-900">1-я подгруппа</h3>
              <span className="text-xs font-bold bg-blue-200 text-blue-800 px-2 py-1 rounded-full shadow-sm">{sub1.length} чел.</span>
            </div>
            <div className="divide-y divide-gray-50 flex-1 overflow-y-auto">
              {sub1.map(s => (
                <div key={s.id} className="flex justify-between items-center px-4 py-2 hover:bg-gray-50 group transition-colors">
                  <span className="text-sm font-medium text-gray-700">{s.fullName}</span>
                  <button 
                    onClick={() => moveTo(s.id, 2)} 
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-all flex items-center gap-1 text-xs font-bold"
                  >
                    В 2-ю <ArrowRight size={14} />
                  </button>
                </div>
              ))}
              {sub1.length === 0 && <div className="p-4 text-center text-sm text-gray-400 italic">Нет студентов</div>}
            </div>
          </div>

          {/* Колонка: Подгруппа 2 */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm flex flex-col h-[50vh]">
            <div className="bg-emerald-50 border-b border-emerald-100 px-4 py-3 flex justify-between items-center">
              <h3 className="font-semibold text-emerald-900">2-я подгруппа</h3>
              <span className="text-xs font-bold bg-emerald-200 text-emerald-800 px-2 py-1 rounded-full shadow-sm">{sub2.length} чел.</span>
            </div>
            <div className="divide-y divide-gray-50 flex-1 overflow-y-auto">
              {sub2.map(s => (
                <div key={s.id} className="flex justify-between items-center px-4 py-2 hover:bg-gray-50 group transition-colors">
                  <button 
                    onClick={() => moveTo(s.id, 1)} 
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-all flex items-center gap-1 text-xs font-bold"
                  >
                    <ArrowLeft size={14} /> В 1-ю
                  </button>
                  <span className="text-sm font-medium text-gray-700">{s.fullName}</span>
                </div>
              ))}
              {sub2.length === 0 && <div className="p-4 text-center text-sm text-gray-400 italic">Нет студентов</div>}
            </div>
          </div>

        </div>

        {/* Футер */}
        <div className="p-5 border-t border-gray-100 bg-white flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
            Отмена
          </button>
          <button onClick={handleSave} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 shadow-sm rounded-lg transition-colors">
            Сохранить списки
          </button>
        </div>
      </div>
    </div>
  );
}