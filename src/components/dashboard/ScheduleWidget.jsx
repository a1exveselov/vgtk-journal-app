import React, { useState } from 'react';
import { Clock, MapPin, Users, ArrowRight, BookOpen, Layers, UserCheck, CalendarDays, Utensils } from 'lucide-react';
import { mockSchedule } from '../../mocks/initialData';

export default function ScheduleWidget({ onSelectJournal, isCuratorView = false, groupFilter = null }) {
  const [selectedDay, setSelectedDay] = useState('today');

  const currentDayData = mockSchedule[selectedDay];
  const lessons = groupFilter
    ? currentDayData.lessons.filter(l => l.group === groupFilter)
    : currentDayData.lessons;

  const isSplitRoom = (room) => room && room.includes('/');

  // Считаем учебные часы (без учета обеда)
  const totalAcademicHours = lessons
    .filter(l => !l.isLunch)
    .reduce((sum, l) => sum + (l.hoursCount || 1), 0);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Шапка виджета */}
      <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-100 text-blue-600 rounded-xl">
            <Clock size={22} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {isCuratorView ? `Расписание группы ${groupFilter || 'ПО-31'}` : 'Расписание занятий'}
            </h2>
            <p className="text-sm text-gray-500 flex items-center gap-1.5">
              <CalendarDays size={14} className="text-gray-400" />
              <span>ВГТК • {currentDayData.dateLabel}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <div className="inline-flex bg-gray-200/80 p-1 rounded-xl">
            <button
              onClick={() => setSelectedDay('today')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedDay === 'today'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Сегодня
            </button>
            <button
              onClick={() => setSelectedDay('tomorrow')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedDay === 'tomorrow'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Завтра
            </button>
          </div>

          <span className="text-xs font-bold px-3 py-1.5 bg-blue-50 text-blue-700 rounded-xl border border-blue-100">
            Учебных часов: {totalAcademicHours}
          </span>
        </div>
      </div>

      {/* Сетка расписания */}
      <div className="divide-y divide-gray-200">
        {lessons.map((item) => {
          const split = isSplitRoom(item.room);
          const isPair = (item.hoursCount || 1) === 2;

          // Отображение строки Обеда (1 академический час)
          if (item.isLunch) {
            return (
              <div key={item.id} className="p-3.5 bg-amber-50/90 flex items-center gap-4">
                <div className="flex flex-col gap-1 min-w-[140px]">
                  {item.slots?.map(slot => (
                    <div key={slot.num} className="flex items-center border border-amber-300 rounded-lg overflow-hidden text-xs">
                      <span className="bg-gray-100 px-2 py-1 font-bold text-gray-700 border-r border-amber-300 w-7 text-center">
                        {slot.num}.
                      </span>
                      <span className="bg-yellow-300 px-2.5 py-1 font-bold text-gray-900 flex-1 text-center">
                        {slot.time}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2 px-4 py-1.5 bg-amber-400/90 text-gray-900 font-bold rounded-xl text-sm shadow-2xs">
                  <Utensils size={16} />
                  <span>Обед (1 ак. час)</span>
                </div>
              </div>
            );
          }

          return (
            <div key={item.id} className="p-4 hover:bg-blue-50/30 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
              {/* Левая часть: Сетка уроков (2 урока для пары, 1 для одиночного урока) */}
              <div className="flex items-center gap-4">
                <div className="flex flex-col gap-1 min-w-[140px]">
                  {item.slots?.map(slot => (
                    <div key={slot.num} className="flex items-center border border-gray-300 rounded-lg overflow-hidden text-xs shadow-2xs">
                      <span className="bg-gray-100 px-2 py-1 font-bold text-gray-700 border-r border-gray-300 w-7 text-center">
                        {slot.num}.
                      </span>
                      <span className="bg-yellow-300/90 px-2.5 py-1 font-bold text-gray-900 flex-1 text-center">
                        {slot.time}
                      </span>
                    </div>
                  ))}
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                      isPair ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                    }`}>
                      {isPair ? `ПАРА (2 ч.) • ${item.type}` : `УРОК (1 ч.)`}
                    </span>
                    <span className="text-xs font-semibold text-gray-500 flex items-center gap-1">
                      <Users size={12} /> {item.group}
                    </span>
                    {item.teacher && (
                      <span className="text-xs font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 flex items-center gap-1">
                        <UserCheck size={12} /> {item.teacher}
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-gray-900 text-base">{item.subject}</h3>
                  
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold ${
                      split 
                        ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      <MapPin size={13} /> Аудитория: {item.room}
                    </span>

                    {split && (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-700 font-medium">
                        <Layers size={13} /> Деление по подгруппам
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Правая часть: Кнопка перехода в журнал */}
              {onSelectJournal && (
                <button
                  onClick={() => onSelectJournal(item.sheetId, item.isMainSheet)}
                  className="self-start md:self-center flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl shadow-sm transition-all cursor-pointer shrink-0"
                >
                  <BookOpen size={16} />
                  <span>Открыть журнал</span>
                  <ArrowRight size={14} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}