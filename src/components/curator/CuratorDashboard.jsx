import React, { useState, useEffect } from 'react';
import {
  Users,
  AlertTriangle,
  Award,
  Clock,
  FileSpreadsheet,
  Download,
  Eraser,
  CheckCircle2,
  Calendar,
  RotateCcw
} from 'lucide-react';
import { mockStudents, mockGrades, mockLessons, currentUser } from '../../mocks/initialData';
import ScheduleWidget from '../dashboard/ScheduleWidget';

// Типы причин согласно Форме №6 ВГТК
const ABSENCE_TYPES = [
  { code: 'Б', label: 'Больничный (Б)', color: 'bg-sky-100 text-sky-800 border-sky-300', isExcused: true },
  { code: 'О', label: 'Объяснительная (О)', color: 'bg-indigo-100 text-indigo-800 border-indigo-300', isExcused: true },
  { code: 'З', label: 'Заявление (З)', color: 'bg-violet-100 text-violet-800 border-violet-300', isExcused: true },
  { code: 'К', label: 'Мероприятия (К)', color: 'bg-emerald-100 text-emerald-800 border-emerald-300', isExcused: true },
  { code: 'Н/У', label: 'Неуважительная (Н/У)', color: 'bg-red-100 text-red-800 border-red-300', isExcused: false },
  { code: 'Сп', label: 'Свободное посещение (Сп)', color: 'bg-amber-100 text-amber-800 border-amber-300', isFree: true },
];

const HOURS_PRESETS = [1, 2, 3, 4, 6, 8];

export default function CuratorDashboard() {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'form6'
  
  // Настройки шапки Формы №6
  const [monthName, setMonthName] = useState('октябрь');
  const [year, setYear] = useState('2026');
  const [course, setCourse] = useState(currentUser.course || 3);
  const [groupName, setGroupName] = useState(currentUser.curatorGroup || 'ПО-31');
  const [deptHead, setDeptHead] = useState(currentUser.departmentHead || 'Н.Е. Дасько');
  const [curatorName, setCuratorName] = useState(currentUser.curatorShortName || 'И.И. Иванов');

  // Загружаем актуальные данные журналов из localStorage
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
      return saved ? JSON.parse(saved) : mockLessons;
    } catch {
      return mockLessons;
    }
  });

  const [grades] = useState(() => {
    try {
      const saved = localStorage.getItem('vgtk_grades');
      return saved ? JSON.parse(saved) : mockGrades;
    } catch {
      return mockGrades;
    }
  });

  // Инструмент разметки куратора
  const [selectedReason, setSelectedReason] = useState('Б');
  // 'auto' — менять только причину, сохраняя посчитанные часы; число — принудительно задать указанное количество часов
  const [hoursMode, setHoursMode] = useState('auto');
  const [customHoursInput, setCustomHoursInput] = useState(2);
  const [toolAction, setToolAction] = useState('stamp'); // 'stamp' | 'eraser' | 'resetToJournal'

  // Переопределения куратора (хранятся в localStorage):
  // ключ `${studentId}_${day}` -> { reason: 'Б'|'О'|'З'|'К'|'Н/У'|'Сп', customHours: number | null, cleared: boolean }
  const [curatorOverrides, setCuratorOverrides] = useState(() => {
    try {
      const saved = localStorage.getItem('vgtk_form6_overrides');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem('vgtk_form6_overrides', JSON.stringify(curatorOverrides));
  }, [curatorOverrides]);

  const daysInMonth = Array.from({ length: 31 }, (_, i) => i + 1);

  // Считаем часы пропусков за каждый день напрямую из предметных журналов (1 «Н» = 1 ак. час)
  const journalHoursMap = {};
  grades.forEach(g => {
    if (g.attendance === 'ABSENT') {
      const lesson = lessons.find(l => l.id === g.lessonId);
      const day = lesson?.day || parseInt(lesson?.date?.split('.')[0], 10);
      if (day) {
        const key = `${g.studentId}_${day}`;
        journalHoursMap[key] = (journalHoursMap[key] || 0) + 1;
      }
    }
  });

  // Получаем итоговое состояние ячейки (объединяем часы из журнала и правки куратора)
  const getCellEntry = (studentId, day) => {
    const key = `${studentId}_${day}`;
    const journalHours = journalHoursMap[key] || 0;
    const override = curatorOverrides[key];

    if (override?.cleared) {
      return null;
    }

    if (override?.reason === 'Сп') {
      return { reason: 'Сп', hours: 0, journalHours, isManualHours: false };
    }

    const effectiveHours =
      override?.customHours !== undefined && override?.customHours !== null
        ? Number(override.customHours)
        : journalHours;

    if (effectiveHours <= 0) {
      return null;
    }

    return {
      reason: override?.reason || 'Н/У',
      hours: effectiveHours,
      journalHours,
      isManualHours: override?.customHours !== undefined && override?.customHours !== null && override.customHours !== journalHours
    };
  };

  // Обработка клика куратора по ячейке дня в Форме №6
  const handleCellClick = (studentId, day) => {
    const key = `${studentId}_${day}`;
    const currentEntry = getCellEntry(studentId, day);
    const journalHours = journalHoursMap[key] || 0;

    setCuratorOverrides(prev => {
      const updated = { ...prev };

      // 1. Ластик (полная очистка ячейки)
      if (toolAction === 'eraser') {
        updated[key] = { cleared: true };
        return updated;
      }

      // 2. Сброс ячейки к исходным часам из предметного журнала
      if (toolAction === 'resetToJournal') {
        delete updated[key];
        return updated;
      }

      // 3. Свободное посещение (Сп)
      if (selectedReason === 'Сп') {
        updated[key] = { reason: 'Сп', customHours: null, cleared: false };
        return updated;
      }

      // 4. Режим «Авто (только причина)» — сохраняем уже посчитанные в ячейке часы
      if (hoursMode === 'auto') {
        const existingHours = currentEntry?.hours || journalHours;
        updated[key] = {
          reason: selectedReason,
          // Если в ячейке уже были часы (из журнала или ручные), сохраняем их; если клетка была пустой — ставим 2 ч.
          customHours: existingHours > 0 ? existingHours : 2,
          cleared: false
        };
        return updated;
      }

      // 5. Ручной режим часов — ставим и выбранную причину, и выбранное количество часов
      const targetHours = Number(customHoursInput) || 2;
      updated[key] = {
        reason: selectedReason,
        customHours: targetHours,
        cleared: false
      };
      return updated;
    });
  };

  // Расчет итогов по студенту для Формы №6
  const getForm6StudentTotals = (studentId) => {
    const totals = { 'Б': 0, 'О': 0, 'З': 0, 'К': 0, excusedTotal: 0, 'Н/У': 0, grandTotal: 0 };
    daysInMonth.forEach(day => {
      const entry = getCellEntry(studentId, day);
      if (!entry || entry.reason === 'Сп') return;
      const h = Number(entry.hours) || 0;
      if (['Б', 'О', 'З', 'К'].includes(entry.reason)) {
        totals[entry.reason] += h;
        totals.excusedTotal += h;
      } else if (entry.reason === 'Н/У') {
        totals['Н/У'] += h;
      }
      totals.grandTotal += h;
    });
    return totals;
  };

  // Итоги «Всего по группе» для нижней строки Формы №6
  const groupForm6Totals = students.reduce(
    (acc, st) => {
      const t = getForm6StudentTotals(st.id);
      acc['Б'] += t['Б'];
      acc['О'] += t['О'];
      acc['З'] += t['З'];
      acc['К'] += t['К'];
      acc.excusedTotal += t.excusedTotal;
      acc['Н/У'] += t['Н/У'];
      acc.grandTotal += t.grandTotal;
      return acc;
    },
    { 'Б': 0, 'О': 0, 'З': 0, 'К': 0, excusedTotal: 0, 'Н/У': 0, grandTotal: 0 }
  );

  // Генерация и скачивание файла «Форма №6» в формате Word (.doc)
  // В клетках дней выводятся ТОЛЬКО часы без букв (или «Сп» для свободного посещения)
  const handleDownloadForm6 = () => {
    const daysHeaders = daysInMonth.map(d => `<th style="width:20px; font-size:9pt;">${d}</th>`).join('');
    
    const rowsHtml = students.map((st, idx) => {
      const t = getForm6StudentTotals(st.id);
      const dayCells = daysInMonth.map(d => {
        const entry = getCellEntry(st.id, d);
        let text = '';
        if (entry) {
          // Только число часов без буквы причины (либо «Сп» для свободного посещения)
          text = entry.reason === 'Сп' ? 'Сп' : String(entry.hours);
        }
        return `<td style="text-align:center; font-size:9pt;">${text}</td>`;
      }).join('');

      return `
        <tr>
          <td style="text-align:center;">${idx + 1}.</td>
          <td style="white-space:nowrap; padding-left:4px;">${st.fullName}</td>
          ${dayCells}
          <td style="text-align:center;">${t['Б'] || ''}</td>
          <td style="text-align:center;">${t['О'] || ''}</td>
          <td style="text-align:center;">${t['З'] || ''}</td>
          <td style="text-align:center;">${t['К'] || ''}</td>
          <td style="text-align:center; font-weight:bold;">${t.excusedTotal || ''}</td>
          <td style="text-align:center;">${t['Н/У'] || ''}</td>
          <td style="text-align:center; font-weight:bold;">${t.grandTotal || ''}</td>
        </tr>
      `;
    }).join('');

    const htmlContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:w="urn:schemas-microsoft-com:office:word"
            xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8" />
        <title>Форма №6 - ${groupName}</title>
        <style>
          @page Section1 {
            size: 29.7cm 21.0cm;
            mso-page-orientation: landscape;
            margin: 1.2cm 1.2cm 1.2cm 1.2cm;
          }
          div.Section1 { page: Section1; }
          body { font-family: "Times New Roman", serif; font-size: 11pt; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #000; padding: 2px; font-family: "Times New Roman", serif; font-size: 9.5pt; }
          .header-right { text-align: right; font-weight: bold; font-size: 11pt; }
          .center-title { text-align: center; font-weight: bold; font-size: 12pt; margin: 2px 0; }
          .center-sub { text-align: center; font-size: 11pt; margin: 2px 0; }
        </style>
      </head>
      <body>
        <div class="Section1">
          <div class="header-right">Форма №6</div>
          <div class="center-title">ВЕДОМОСТЬ</div>
          <div class="center-sub">учёта учебных часов, пропущенных учащимися</div>
          <div class="center-sub">учреждения образования «Витебский государственный технический колледж»</div>
          <div class="center-sub">за <u>&nbsp;${monthName}&nbsp;</u> ${year} г.</div>
          <div class="center-sub" style="margin-bottom:8px;"><u>${course}</u> курс группа <u>${groupName}</u></div>

          <table>
            <thead>
              <tr>
                <th rowspan="3" style="width:28px;">№ п.п.</th>
                <th rowspan="3" style="width:150px;">ФИО</th>
                <th colspan="31">Число</th>
                <th colspan="6">Пропуски</th>
                <th rowspan="3" style="width:45px;">ВСЕГО</th>
              </tr>
              <tr>
                ${daysHeaders}
                <th colspan="5">Уважительные</th>
                <th rowspan="2" style="width:36px;">Н/У</th>
              </tr>
              <tr>
                ${daysInMonth.map(() => `<th></th>`).join('')}
                <th style="width:28px;">Б</th>
                <th style="width:28px;">О</th>
                <th style="width:28px;">З</th>
                <th style="width:28px;">К</th>
                <th style="width:40px;">Всего</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
              <tr style="font-weight:bold;">
                <td colspan="33" style="text-align:right; padding-right:8px;">Всего по группе:</td>
                <td style="text-align:center;">${groupForm6Totals['Б']}</td>
                <td style="text-align:center;">${groupForm6Totals['О']}</td>
                <td style="text-align:center;">${groupForm6Totals['З']}</td>
                <td style="text-align:center;">${groupForm6Totals['К']}</td>
                <td style="text-align:center;">${groupForm6Totals.excusedTotal}</td>
                <td style="text-align:center;">${groupForm6Totals['Н/У']}</td>
                <td style="text-align:center;">${groupForm6Totals.grandTotal}</td>
              </tr>
            </tbody>
          </table>

          <p style="margin-top:14px; font-size:11pt;">
            Зав. отделением __________________ ${deptHead} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            Куратор __________________ ${curatorName}
          </p>

          <p style="margin-top:10px; font-size:9.5pt; line-height:1.35;">
            <b>Условные обозначения:</b><br/>
            Б – больничный; З – заявление; О – объяснительная; К – снятие на общеколледжные, районные, городские мероприятия; Н/У – неуважительные причины; Сп – свободное посещение.
          </p>
        </div>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Форма_6_${groupName}_${monthName}_${year}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Статистика успеваемости для вкладки обзора
  const studentsStats = students.map(student => {
    const studentGrades = grades.filter(g => g.studentId === student.id);
    const numericGrades = studentGrades
      .filter(g => g.attendance !== 'ABSENT' && g.grade !== null && g.grade !== '')
      .map(g => Number(g.grade))
      .filter(val => !isNaN(val));

    const avg = numericGrades.length > 0
      ? (numericGrades.reduce((sum, val) => sum + val, 0) / numericGrades.length).toFixed(2)
      : null;

    const form6Totals = getForm6StudentTotals(student.id);

    return {
      ...student,
      avg: avg ? parseFloat(avg) : 0,
      excusedHours: form6Totals.excusedTotal,
      unexcusedHours: form6Totals['Н/У'],
      totalHours: form6Totals.grandTotal
    };
  });

  const totalStudents = students.length;
  const groupNumericGrades = studentsStats.map(s => s.avg).filter(val => val > 0);
  const groupAvg = groupNumericGrades.length > 0
    ? (groupNumericGrades.reduce((sum, val) => sum + val, 0) / groupNumericGrades.length).toFixed(2)
    : '0.00';

  const riskStudents = studentsStats.filter(s => s.unexcusedHours >= 4 || (s.avg > 0 && s.avg < 5));

  return (
    <div className="p-6 md:p-8 max-w-[1440px] mx-auto space-y-6">
      {/* Шапка кураторской панели */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Кураторский дашборд: группа {groupName}</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            ВГТК • Автоматический сбор пропусков из журналов и формирование «Формы №6»
          </p>
        </div>

        <div className="inline-flex bg-gray-100 p-1.5 rounded-xl self-start md:self-center">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Calendar size={16} />
            <span>Обзор и расписание</span>
          </button>
          <button
            onClick={() => setActiveTab('form6')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'form6'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <FileSpreadsheet size={16} />
            <span>Ведомость «Форма №6»</span>
          </button>
        </div>
      </div>

      {activeTab === 'overview' ? (
        /* ВКЛАДКА 1: ОБЗОР ГРУППЫ И РАСПИСАНИЕ С ПРЕПОДАВАТЕЛЯМИ */
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-4">
              <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
                <Users size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Учащихся в группе</p>
                <h3 className="text-2xl font-extrabold text-gray-900">{totalStudents}</h3>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-4">
              <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl">
                <Award size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Средний балл группы</p>
                <h3 className="text-2xl font-extrabold text-gray-900">{groupAvg}</h3>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-4">
              <div className="p-3 bg-red-100 text-red-600 rounded-xl">
                <Clock size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Пропусков за месяц (Всего / Н/У)</p>
                <h3 className="text-2xl font-extrabold text-gray-900">
                  {groupForm6Totals.grandTotal} ч.{' '}
                  <span className="text-sm font-semibold text-red-600">
                    (Н/У: {groupForm6Totals['Н/У']} ч.)
                  </span>
                </h3>
              </div>
            </div>
          </div>

          <ScheduleWidget isCuratorView={true} groupFilter={groupName} />

          {riskStudents.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-4">
              <div className="p-2 bg-amber-100 text-amber-700 rounded-xl mt-0.5">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h4 className="font-bold text-amber-900">Зона внимания куратора</h4>
                <p className="text-xs text-amber-700 mt-0.5">
                  Низкий средний балл или неразнесенные неуважительные пропуски:{' '}
                  <span className="font-semibold">{riskStudents.map(s => s.fullName).join(', ')}</span>.
                </p>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-xs border border-gray-200 overflow-hidden">
            <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
              <h3 className="font-bold text-gray-800 text-base">Сводная ведомость учащихся</h3>
              <button
                onClick={() => setActiveTab('form6')}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
              >
                Перейти к разметке причин в Форме №6 →
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-700 uppercase bg-gray-100 border-b border-gray-200">
                  <tr>
                    <th className="px-5 py-3 font-semibold w-12 text-center">№</th>
                    <th className="px-5 py-3 font-semibold">ФИО Учащегося</th>
                    <th className="px-5 py-3 font-semibold text-center">Подгруппа</th>
                    <th className="px-5 py-3 font-semibold text-center">Средний балл</th>
                    <th className="px-5 py-3 font-semibold text-center">Уважительные (ч.)</th>
                    <th className="px-5 py-3 font-semibold text-center">Неуважительные Н/У (ч.)</th>
                    <th className="px-5 py-3 font-semibold text-center">Всего пропусков (ч.)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {studentsStats.map((student, idx) => (
                    <tr key={student.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="px-5 py-3 text-center text-gray-500">{idx + 1}</td>
                      <td className="px-5 py-3 font-medium text-gray-900">{student.fullName}</td>
                      <td className="px-5 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          student.subgroup === 1 ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {student.subgroup} п/г
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center font-bold">
                        {student.avg > 0 ? (
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            student.avg >= 8 ? 'bg-emerald-100 text-emerald-800' :
                            student.avg >= 5 ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {student.avg.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-center font-medium text-emerald-700">
                        {student.excusedHours > 0 ? `${student.excusedHours} ч.` : '0'}
                      </td>
                      <td className="px-5 py-3 text-center">
                        {student.unexcusedHours > 0 ? (
                          <span className="px-2 py-0.5 rounded bg-red-50 text-red-600 font-bold text-xs border border-red-200">
                            {student.unexcusedHours} ч.
                          </span>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-center font-bold text-gray-800">
                        {student.totalHours} ч.
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* ВКЛАДКА 2: ВЕДОМОСТЬ УЧЁТА ЧАСОВ «ФОРМА №6» */
        <div className="space-y-5">
          {/* Панель реквизитов ведомости и кнопки экспорта */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 w-full lg:w-auto">
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase">Месяц</label>
                <select
                  value={monthName}
                  onChange={e => setMonthName(e.target.value)}
                  className="mt-1 w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg font-medium"
                >
                  {['сентябрь', 'октябрь', 'ноябрь', 'декабрь', 'январь', 'февраль', 'март', 'апрель', 'май', 'июнь'].map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase">Год</label>
                <input
                  type="text"
                  value={year}
                  onChange={e => setYear(e.target.value)}
                  className="mt-1 w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg font-medium"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase">Курс</label>
                <input
                  type="number"
                  value={course}
                  onChange={e => setCourse(e.target.value)}
                  className="mt-1 w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg font-medium"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase">Группа</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  className="mt-1 w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg font-medium"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase">Зав. отделением</label>
                <input
                  type="text"
                  value={deptHead}
                  onChange={e => setDeptHead(e.target.value)}
                  className="mt-1 w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg font-medium"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase">Куратор</label>
                <input
                  type="text"
                  value={curatorName}
                  onChange={e => setCuratorName(e.target.value)}
                  className="mt-1 w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg font-medium"
                />
              </div>
            </div>

            <button
              onClick={handleDownloadForm6}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-sm transition-all cursor-pointer shrink-0"
            >
              <Download size={18} />
              <span>Скачать Форму №6 (.doc)</span>
            </button>
          </div>

          {/* Панель быстрой разметки причин и управления часами */}
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={18} className="text-blue-600" />
                <span className="text-sm font-bold text-gray-800">
                  1. Выберите причину отсутствия:
                </span>
              </div>
              <span className="text-xs text-gray-500">
                В скачанном .doc файле в клетках дней будут стоять только цифры часов (без букв)
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {ABSENCE_TYPES.map(type => (
                <button
                  key={type.code}
                  onClick={() => {
                    setToolAction('stamp');
                    setSelectedReason(type.code);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                    toolAction === 'stamp' && selectedReason === type.code
                      ? `${type.color} ring-2 ring-blue-500 shadow-xs`
                      : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {type.label}
                </button>
              ))}

              <button
                onClick={() => setToolAction('resetToJournal')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                  toolAction === 'resetToJournal'
                    ? 'bg-indigo-600 text-white border-indigo-700 ring-2 ring-blue-500'
                    : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                }`}
                title="Вернуть ячейке часы и статус из предметного журнала"
              >
                <RotateCcw size={14} />
                <span>Часы из журнала</span>
              </button>

              <button
                onClick={() => setToolAction('eraser')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                  toolAction === 'eraser'
                    ? 'bg-gray-800 text-white border-gray-900 ring-2 ring-blue-500'
                    : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <Eraser size={14} />
                <span>Очистить клетку</span>
              </button>
            </div>

            {/* Блок контроля количества часов */}
            {toolAction === 'stamp' && selectedReason !== 'Сп' && (
              <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center gap-3">
                <span className="text-xs font-bold text-gray-700">
                  2. Контроль количества часов при клике:
                </span>

                <button
                  onClick={() => setHoursMode('auto')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                    hoursMode === 'auto'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  Авто (менять только причину, сохраняя часы)
                </button>

                <div className="flex items-center gap-1.5 pl-2 border-l border-gray-200">
                  <span className="text-xs text-gray-500 font-medium">Изменить часы вручную:</span>
                  {HOURS_PRESETS.map(h => (
                    <button
                      key={h}
                      onClick={() => {
                        setHoursMode('manual');
                        setCustomHoursInput(h);
                      }}
                      className={`w-7 h-7 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                        hoursMode === 'manual' && Number(customHoursInput) === h
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {h}
                    </button>
                  ))}

                  <input
                    type="number"
                    min={1}
                    max={16}
                    value={customHoursInput}
                    onFocus={() => setHoursMode('manual')}
                    onChange={e => {
                      setHoursMode('manual');
                      setCustomHoursInput(e.target.value);
                    }}
                    className={`w-14 px-2 py-1 text-center text-xs font-bold border rounded-lg outline-none ${
                      hoursMode === 'manual'
                        ? 'border-blue-600 ring-2 ring-blue-500/20 bg-blue-50/30'
                        : 'border-gray-200'
                    }`}
                    title="Ввести своё количество часов"
                  />
                  <span className="text-xs text-gray-400">ч.</span>
                </div>
              </div>
            )}
          </div>

          {/* Таблица по образцу Формы №6 */}
          <div className="bg-white rounded-2xl shadow-xs border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-gray-50/70 text-center space-y-0.5">
              <div className="text-right text-xs font-bold text-gray-500">Форма №6</div>
              <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wide">
                ВЕДОМОСТЬ учёта учебных часов, пропущенных учащимися УО «ВГТК»
              </h3>
              <p className="text-xs text-gray-600">
                за <span className="font-bold underline">{monthName}</span> {year} г. • {course} курс группа <span className="font-bold underline">{groupName}</span>
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse whitespace-nowrap select-none">
                <thead>
                  <tr className="bg-gray-100 text-gray-700 border-b border-gray-300">
                    <th rowSpan={3} className="border-r border-gray-300 px-2 py-2 text-center w-10">№</th>
                    <th rowSpan={3} className="border-r border-gray-300 px-3 py-2 text-left sticky left-0 bg-gray-100 z-10 min-w-[170px]">
                      ФИО учащегося
                    </th>
                    <th colSpan={31} className="border-r border-b border-gray-300 py-1.5 text-center font-bold">
                      Число месяца
                    </th>
                    <th colSpan={6} className="border-r border-b border-gray-300 py-1.5 text-center font-bold bg-blue-50/60">
                      Пропуски (часов)
                    </th>
                    <th rowSpan={3} className="px-2.5 py-2 text-center font-extrabold bg-gray-200/70 text-gray-900">
                      ВСЕГО
                    </th>
                  </tr>
                  <tr className="bg-gray-100 text-gray-700 border-b border-gray-300">
                    {daysInMonth.map(day => (
                      <th key={day} rowSpan={2} className="border-r border-gray-200 px-1 py-1 text-center font-semibold min-w-[36px]">
                        {day}
                      </th>
                    ))}
                    <th colSpan={5} className="border-r border-b border-gray-300 py-1 text-center font-bold bg-emerald-50/70 text-emerald-900">
                      Уважительные
                    </th>
                    <th rowSpan={2} className="border-r border-gray-300 px-2 py-1 text-center font-bold bg-red-50/70 text-red-800">
                      Н/У
                    </th>
                  </tr>
                  <tr className="bg-gray-50 text-gray-700 border-b border-gray-300">
                    <th className="border-r border-gray-300 px-2 py-1 text-center font-bold">Б</th>
                    <th className="border-r border-gray-300 px-2 py-1 text-center font-bold">О</th>
                    <th className="border-r border-gray-300 px-2 py-1 text-center font-bold">З</th>
                    <th className="border-r border-gray-300 px-2 py-1 text-center font-bold">К</th>
                    <th className="border-r border-gray-300 px-2 py-1 text-center font-extrabold bg-emerald-100/60">Всего</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-200">
                  {students.map((student, idx) => {
                    const totals = getForm6StudentTotals(student.id);

                    return (
                      <tr key={student.id} className="hover:bg-blue-50/20">
                        <td className="border-r border-gray-200 px-2 py-1.5 text-center text-gray-500">{idx + 1}.</td>
                        <td className="border-r border-gray-300 px-3 py-1.5 font-medium text-gray-900 sticky left-0 bg-white z-10">
                          {student.fullName}
                        </td>

                        {daysInMonth.map(day => {
                          const entry = getCellEntry(student.id, day);
                          const typeMeta = ABSENCE_TYPES.find(t => t.code === entry?.reason);

                          return (
                            <td
                              key={day}
                              onClick={() => handleCellClick(student.id, day)}
                              title={
                                entry
                                  ? `День ${day}: ${entry.reason === 'Сп' ? 'Свободное посещение' : `${entry.hours} ч. (${entry.reason})`}${entry.journalHours ? ` • В журнале: ${entry.journalHours} Н` : ''}`
                                  : `День ${day}: кликните для разметки`
                              }
                              className="border-r border-gray-200 p-0.5 text-center cursor-pointer hover:bg-blue-100/50 transition-colors"
                            >
                              {entry ? (
                                <div className={`w-full py-0.5 px-1 rounded border flex items-center justify-center gap-0.5 ${typeMeta?.color || ''}`}>
                                  {entry.reason === 'Сп' ? (
                                    <span className="text-[10px] font-bold">Сп</span>
                                  ) : (
                                    <>
                                      <span className="text-[11px] font-extrabold leading-none">{entry.hours}</span>
                                      <span className="text-[8px] font-bold opacity-75 leading-none">{entry.reason}</span>
                                    </>
                                  )}
                                </div>
                              ) : (
                                <span className="inline-block w-full h-5" />
                              )}
                            </td>
                          );
                        })}

                        <td className="border-r border-gray-200 px-2 py-1.5 text-center font-medium text-sky-800 bg-sky-50/20">
                          {totals['Б'] || ''}
                        </td>
                        <td className="border-r border-gray-200 px-2 py-1.5 text-center font-medium text-indigo-800 bg-indigo-50/20">
                          {totals['О'] || ''}
                        </td>
                        <td className="border-r border-gray-200 px-2 py-1.5 text-center font-medium text-violet-800 bg-violet-50/20">
                          {totals['З'] || ''}
                        </td>
                        <td className="border-r border-gray-200 px-2 py-1.5 text-center font-medium text-emerald-800 bg-emerald-50/20">
                          {totals['К'] || ''}
                        </td>
                        <td className="border-r border-gray-300 px-2 py-1.5 text-center font-bold text-emerald-900 bg-emerald-100/40">
                          {totals.excusedTotal || 0}
                        </td>
                        <td className="border-r border-gray-300 px-2 py-1.5 text-center font-bold text-red-700 bg-red-50/40">
                          {totals['Н/У'] || 0}
                        </td>
                        <td className="px-2 py-1.5 text-center font-extrabold text-gray-900 bg-gray-100">
                          {totals.grandTotal || 0}
                        </td>
                      </tr>
                    );
                  })}

                  <tr className="bg-gray-100 font-bold text-gray-900 border-t-2 border-gray-300">
                    <td colSpan={33} className="border-r border-gray-300 px-4 py-2 text-right">
                      Всего по группе:
                    </td>
                    <td className="border-r border-gray-300 px-2 py-2 text-center">{groupForm6Totals['Б']}</td>
                    <td className="border-r border-gray-300 px-2 py-2 text-center">{groupForm6Totals['О']}</td>
                    <td className="border-r border-gray-300 px-2 py-2 text-center">{groupForm6Totals['З']}</td>
                    <td className="border-r border-gray-300 px-2 py-2 text-center">{groupForm6Totals['К']}</td>
                    <td className="border-r border-gray-300 px-2 py-2 text-center bg-emerald-100/70 text-emerald-900">
                      {groupForm6Totals.excusedTotal}
                    </td>
                    <td className="border-r border-gray-300 px-2 py-2 text-center bg-red-100/70 text-red-800">
                      {groupForm6Totals['Н/У']}
                    </td>
                    <td className="px-2 py-2 text-center bg-gray-200 text-gray-900">
                      {groupForm6Totals.grandTotal}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-200 flex flex-col md:flex-row justify-between gap-4 text-xs text-gray-600">
              <div className="space-x-6 font-medium text-gray-800">
                <span>Зав. отделением: __________________ <b>{deptHead}</b></span>
                <span>Куратор: __________________ <b>{curatorName}</b></span>
              </div>
              <div>
                <b>Обозначения:</b> Б – больничный; З – заявление; О – объяснительная; К – мероприятия; Н/У – неуважительные; Сп – свободное посещение.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}