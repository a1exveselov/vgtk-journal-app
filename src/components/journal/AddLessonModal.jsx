import React, { useState, useEffect } from 'react';
import { X, Clock, BookOpen, Home, Edit3, Trash2, Calendar, AlertTriangle, Check, ShieldAlert } from 'lucide-react';

// Вспомогательная функция для перевода даты занятия ("27.10" или "2026-10-27") в числовой timestamp
export function getLessonTimestamp(lessonOrDateStr) {
  if (!lessonOrDateStr) return 0;

  if (typeof lessonOrDateStr === 'string') {
    if (lessonOrDateStr.includes('-')) {
      const [y, m, d] = lessonOrDateStr.split('-').map(Number);
      return new Date(y, m - 1, d).getTime();
    }
    if (lessonOrDateStr.includes('.')) {
      const [d, m] = lessonOrDateStr.split('.').map(Number);
      return new Date(2026, m - 1, d).getTime();
    }
  }

  if (lessonOrDateStr.rawDate) {
    const [y, m, d] = lessonOrDateStr.rawDate.split('-').map(Number);
    return new Date(y, m - 1, d).getTime();
  }

  if (lessonOrDateStr.date) {
    const [d, m] = lessonOrDateStr.date.split('.').map(Number);
    return new Date(2026, m - 1, d).getTime();
  }

  return 0;
}

export default function AddLessonModal({
  isOpen,
  onClose,
  onAdd,
  onUpdate,
  onDelete,
  initialLesson = null,
  existingLessons = [],
  canModify = true // Главный преподаватель — true, второй преподаватель — false (только просмотр темы и ДЗ)
}) {
  const [mode, setMode] = useState('create'); // 'create' | 'view' | 'edit'
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [backdateWarning, setBackdateWarning] = useState(null); // { lastDateStr: '29.10' }

  const [formData, setFormData] = useState({
    date: '',
    type: 'ЛЕК',
    hours: 2,
    topic: '',
    homework: ''
  });

  useEffect(() => {
    if (!isOpen) return;
    setConfirmDelete(false);
    setBackdateWarning(null);

    if (initialLesson) {
      setMode('view');
      let isoDate = initialLesson.rawDate || '';
      if (!isoDate && initialLesson.date) {
        const [d, m] = initialLesson.date.split('.');
        if (d && m) {
          isoDate = `2026-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }
      }
      setFormData({
        date: isoDate,
        type: initialLesson.type || 'ЛЕК',
        hours: initialLesson.hours || 2,
        topic: initialLesson.topic || '',
        homework: initialLesson.homework || ''
      });
    } else {
      setMode('create');
      setFormData({
        date: '',
        type: 'ЛЕК',
        hours: 2,
        topic: '',
        homework: ''
      });
    }
  }, [isOpen, initialLesson]);

  if (!isOpen) return null;

  // Находим последнее по списку/дате существующее занятие для проверки хронологии
  const getLatestExistingLesson = () => {
    const relevantLessons = existingLessons.filter(l =>
      mode === 'edit' && initialLesson ? l.id !== initialLesson.id : true
    );
    if (relevantLessons.length === 0) return null;

    return relevantLessons.reduce((latest, current) => {
      return getLessonTimestamp(current) >= getLessonTimestamp(latest) ? current : latest;
    }, relevantLessons[0]);
  };

  // Финальное сохранение занятия (вызывается напрямую или после подтверждения заднего числа)
  const commitSaveLesson = () => {
    const dateObj = new Date(formData.date);
    const day = dateObj.getDate();
    const formattedDate = `${String(day).padStart(2, '0')}.${String(dateObj.getMonth() + 1).padStart(2, '0')}`;

    const payload = {
      ...formData,
      rawDate: formData.date,
      hours: Number(formData.hours),
      date: formattedDate,
      day,
      createdByMain: true,
      isSubgroupOnly: formData.type === 'ПР' || formData.type === 'ЛАБ'
    };

    if (mode === 'edit' && initialLesson) {
      onUpdate({ ...initialLesson, ...payload });
    } else {
      onAdd(payload);
    }

    setBackdateWarning(null);
    onClose();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.date) return alert('Выберите дату');

    // Проверка хронологического порядка дат
    const latestLesson = getLatestExistingLesson();
    if (latestLesson) {
      const enteredTs = getLessonTimestamp(formData.date);
      const latestTs = getLessonTimestamp(latestLesson);

      if (enteredTs < latestTs && !backdateWarning) {
        setBackdateWarning({
          lastDateStr: latestLesson.date,
          lastType: latestLesson.type
        });
        return;
      }
    }

    commitSaveLesson();
  };

  const handleChange = (e) => {
    setBackdateWarning(null);
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        {/* Шапка модального окна */}
        <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-gray-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
              <Calendar size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">
                {mode === 'create' && 'Новое занятие'}
                {mode === 'view' && `Занятие от ${initialLesson?.date}`}
                {mode === 'edit' && `Редактирование занятия (${initialLesson?.date})`}
              </h2>
              {mode === 'view' && (
                <p className="text-xs text-gray-500">
                  {canModify ? 'Информация о теме, часах и ДЗ' : 'Занятие создано главным преподавателем'}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-red-500 transition-colors rounded-full p-1 hover:bg-red-50 cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* РЕЖИМ ПРОСМОТРА КАРТОЧКИ ЗАНЯТИЯ */}
        {mode === 'view' && initialLesson ? (
          <div className="p-5 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-lg text-xs font-bold">
                Тип: {initialLesson.type}
              </span>
              <span className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold flex items-center gap-1">
                <Clock size={13} />
                {(initialLesson.hours || 2) === 2 ? 'Пара (2 ак. часа)' : 'Урок (1 ак. час)'}
              </span>
              {(initialLesson.type === 'ПР' || initialLesson.type === 'ЛАБ' || initialLesson.isSubgroupOnly) && (
                <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-lg text-xs font-semibold">
                  Деление по подгруппам
                </span>
              )}
            </div>

            <div className="p-4 rounded-xl bg-gray-50 border border-gray-200/80 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase">
                <BookOpen size={14} className="text-blue-600" />
                <span>Тема занятия</span>
              </div>
              {initialLesson.topic ? (
                <p className="text-sm font-semibold text-gray-900 leading-relaxed whitespace-pre-wrap">
                  {initialLesson.topic}
                </p>
              ) : (
                <p className="text-sm text-gray-400 italic">Тема не указана</p>
              )}
            </div>

            <div className="p-4 rounded-xl bg-blue-50/40 border border-blue-100 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700 uppercase">
                <Home size={14} className="text-blue-600" />
                <span>Домашнее задание</span>
              </div>
              {initialLesson.homework ? (
                <p className="text-sm font-medium text-gray-800 leading-relaxed whitespace-pre-wrap">
                  {initialLesson.homework}
                </p>
              ) : (
                <p className="text-sm text-gray-400 italic">Домашнее задание не задано</p>
              )}
            </div>

            {confirmDelete ? (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl space-y-2.5">
                <div className="flex items-start gap-2 text-red-800 text-xs">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5 text-red-600" />
                  <span>
                    Удалить колонку занятия за <b>{initialLesson.date}</b>? Все выставленные в эту дату оценки и «Н» также будут удалены.
                  </span>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onDelete(initialLesson.id);
                      onClose();
                    }}
                    className="px-3 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg cursor-pointer"
                  >
                    Да, удалить колонку
                  </button>
                </div>
              </div>
            ) : (
              <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                {canModify ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 size={15} />
                    <span>Удалить</span>
                  </button>
                ) : (
                  <span className="text-[11px] text-gray-400">Редактирование доступно главному преподавателю</span>
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                  >
                    Закрыть
                  </button>
                  {canModify && (
                    <button
                      type="button"
                      onClick={() => setMode('edit')}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors cursor-pointer"
                    >
                      <Edit3 size={14} />
                      <span>Редактировать</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* РЕЖИМ СОЗДАНИЯ ИЛИ РЕДАКТИРОВАНИЯ ЗАНЯТИЯ */
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Формат занятия (количество часов)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, hours: 2 })}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                    Number(formData.hours) === 2
                      ? 'border-blue-600 bg-blue-50/70 text-blue-900 ring-2 ring-blue-500/20'
                      : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <Clock size={18} className={Number(formData.hours) === 2 ? 'text-blue-600 mt-0.5' : 'text-gray-400 mt-0.5'} />
                  <div>
                    <div className="text-sm font-bold">Пара (2 часа)</div>
                    <div className="text-[11px] text-gray-500">2 клетки на дату</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, hours: 1 })}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                    Number(formData.hours) === 1
                      ? 'border-blue-600 bg-blue-50/70 text-blue-900 ring-2 ring-blue-500/20'
                      : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <Clock size={18} className={Number(formData.hours) === 1 ? 'text-blue-600 mt-0.5' : 'text-gray-400 mt-0.5'} />
                  <div>
                    <div className="text-sm font-bold">Урок (1 час)</div>
                    <div className="text-[11px] text-gray-500">1 клетка на дату</div>
                  </div>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Дата</label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Тип занятия</label>
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all cursor-pointer text-sm"
                >
                  <option value="ЛЕК">Лекция (ЛЕК)</option>
                  <option value="ПР">Практика (ПР)</option>
                  <option value="ЛАБ">Лабораторная (ЛАБ)</option>
                  <option value="УРОК">Урок (1 ч.)</option>
                  <option value="КР">Контрольная (КР)</option>
                  <option value="ОК">ОК</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Тема занятия</label>
              <textarea
                rows={2}
                name="topic"
                value={formData.topic}
                onChange={handleChange}
                placeholder="Например: Паттерны проектирования в ООП"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Домашнее задание</label>
              <textarea
                rows={2}
                name="homework"
                value={formData.homework}
                onChange={handleChange}
                placeholder="Например: Конспект лекции, подготовить отчёт"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm resize-none"
              />
            </div>

            {/* Предупреждение о нарушении хронологического порядка дат */}
            {backdateWarning && (
              <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-3">
                <div className="flex items-start gap-2.5 text-amber-900 text-xs leading-relaxed">
                  <ShieldAlert size={18} className="shrink-0 mt-0.5 text-amber-600" />
                  <div>
                    <span className="font-bold block text-amber-950 mb-0.5">
                      Нарушение хронологического порядка дат
                    </span>
                    Введенная дата занятия раньше предыдущего созданного занятия в журнале (<b>{backdateWarning.lastDateStr} • {backdateWarning.lastType}</b>). Вы уверены, что хотите добавить занятие задним числом?
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setBackdateWarning(null)}
                    className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer"
                  >
                    Отменить сохранение
                  </button>
                  <button
                    type="button"
                    onClick={commitSaveLesson}
                    className="px-3 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-2xs cursor-pointer"
                  >
                    Да, добавить задним числом
                  </button>
                </div>
              </div>
            )}

            {!backdateWarning && (
              <div className="pt-4 flex justify-end gap-2.5 border-t border-gray-100 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    if (mode === 'edit' && initialLesson) {
                      setMode('view');
                    } else {
                      onClose();
                    }
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  <Check size={16} />
                  <span>
                    {mode === 'edit'
                      ? 'Сохранить изменения'
                      : `Создать (${Number(formData.hours) === 2 ? '2 клетки' : '1 клетку'})`}
                  </span>
                </button>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}