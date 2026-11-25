import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { mockStudents, mockGrades, mockLessons, currentUser } from '../../mocks/initialData';
import ScheduleWidget from '../dashboard/ScheduleWidget';

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

const HOURS_PRESETS = [1, 2, 3, 4, 6, 8];

export default function CuratorDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  
  const [monthName, setMonthName] = useState('октябрь');
  const [year, setYear] = useState('2026');
  const [course, setCourse] = useState(currentUser.course || 3);
  const [groupName, setGroupName] = useState(currentUser.curatorGroup || 'ПО-31');
  const [deptHead, setDeptHead] = useState(currentUser.departmentHead || 'Н.Е. Дасько');
  const [curatorName, setCuratorName] = useState(currentUser.curatorShortName || 'И.И. Иванов');

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

  const [selectedReason, setSelectedReason] = useState('Б');
  const [hoursMode, setHoursMode] = useState('auto');
  const [customHoursInput, setCustomHoursInput] = useState(2);
  const [toolAction, setToolAction] = useState('stamp');

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

  const journalHoursMap = {};
  grades.forEach((g) => {
    if (g.attendance === 'ABSENT') {
      const lesson = lessons.find((l) => l.id === g.lessonId);
      const day = lesson?.day || parseInt(lesson?.date?.split('.')[0], 10);
      if (day) {
        const key = `${g.studentId}_${day}`;
        journalHoursMap[key] = (journalHoursMap[key] || 0) + 1;
      }
    }
  });

  const getCellEntry = (studentId, day) => {
    const key = `${studentId}_${day}`;
    const journalHours = journalHoursMap[key] || 0;
    const override = curatorOverrides[key];

    if (override?.cleared) return null;
    if (override?.reason === 'Сп') {
      return { reason: 'Сп', hours: 0, journalHours, isManualHours: false };
    }

    const effectiveHours =
      override?.customHours !== undefined && override?.customHours !== null
        ? Number(override.customHours)
        : journalHours;

    if (effectiveHours <= 0) return null;

    return {
      reason: override?.reason || 'Н/У',
      hours: effectiveHours,
      journalHours,
      isManualHours:
        override?.customHours !== undefined &&
        override?.customHours !== null &&
        override.customHours !== journalHours
    };
  };

  const handleCellClick = (studentId, day) => {
    const key = `${studentId}_${day}`;
    const currentEntry = getCellEntry(studentId, day);
    const journalHours = journalHoursMap[key] || 0;

    setCuratorOverrides((prev) => {
      const updated = { ...prev };
      if (toolAction === 'eraser') {
        updated[key] = { cleared: true };
        return updated;
      }
      if (toolAction === 'resetToJournal') {
        delete updated[key];
        return updated;
      }
      if (selectedReason === 'Сп') {
        updated[key] = { reason: 'Сп', customHours: null, cleared: false };
        return updated;
      }
      if (hoursMode === 'auto') {
        const existingHours = currentEntry?.hours || journalHours;
        updated[key] = {
          reason: selectedReason,
          customHours: existingHours > 0 ? existingHours : 2,
          cleared: false
        };
        return updated;
      }
      const targetHours = Number(customHoursInput) || 2;
      updated[key] = {
        reason: selectedReason,
        customHours: targetHours,
        cleared: false
      };
      return updated;
    });
  };

  const getForm6StudentTotals = (studentId) => {
    const totals = { 'Б': 0, 'О': 0, 'З': 0, 'К': 0, excusedTotal: 0, 'Н/У': 0, grandTotal: 0 };
    daysInMonth.forEach((day) => {
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

  const handleDownloadForm6 = () => {
    const daysHeaders = daysInMonth.map((d) => `<th style="width:20px; font-size:9pt;">${d}</th>`).join('');
    
    const rowsHtml = students.map((st, idx) => {
      const t = getForm6StudentTotals(st.id);
      const dayCells = daysInMonth.map((d) => {
        const entry = getCellEntry(st.id, d);
        let text = '';
        if (entry) {
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

  const studentsStats = students.map((student) => {
    const studentGrades = grades.filter((g) => g.studentId === student.id);
    const numericGrades = studentGrades
      .filter((g) => g.attendance !== 'ABSENT' && g.grade !== null && g.grade !== '')
      .map((g) => Number(g.grade))
      .filter((val) => !isNaN(val));

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
  const groupNumericGrades = studentsStats.map((s) => s.avg).filter((val) => val > 0);
  const groupAvg = groupNumericGrades.length > 0
    ? (groupNumericGrades.reduce((sum, val) => sum + val, 0) / groupNumericGrades.length).toFixed(2)
    : '0.00';

  const riskStudents = studentsStats.filter((s) => s.unexcusedHours >= 4 || (s.avg > 0 && s.avg < 5));

  return (
    <div className="space-y-6">
      <header className="page-heading">
        <div><p className="section-kicker">Кабинет куратора</p><h1>Группа {groupName}</h1></div>
        <div className="section-tabs" role="group" aria-label="Раздел кабинета">
          <button aria-pressed={activeTab === 'overview'} onClick={() => setActiveTab('overview')}>Обзор группы</button>
          <button aria-pressed={activeTab === 'form6'} onClick={() => setActiveTab('form6')}>Форма № 6</button>
        </div>
      </header>

      {activeTab === 'overview' ? (
        <div className="space-y-6">
          <dl className="metric-strip">
            <div><dt>Учащихся в группе</dt><dd>{totalStudents}</dd></div>
            <div><dt>Средний балл</dt><dd>{groupAvg}</dd></div>
            <div><dt>Пропущено за месяц</dt><dd>{groupForm6Totals.grandTotal} ч.</dd><small>Без уважительной причины {groupForm6Totals['Н/У']} ч.</small></div>
          </dl>

          <ScheduleWidget groupFilter={groupName} />

          {riskStudents.length > 0 && (
            <div className="bg-[#F4E8D4] dark:bg-[#22201B] border border-amber-400/60 dark:border-amber-500/40 rounded-sm p-5 flex items-start gap-4">
              <div className="p-2 bg-amber-400/30 dark:bg-amber-500/20 text-amber-950 dark:text-amber-300 rounded-sm mt-0.5">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h4 className="font-bold text-stone-900 dark:text-amber-200">Зона внимания куратора</h4>
                <p className="text-xs text-stone-700 dark:text-zinc-300 mt-0.5">
                  Низкий средний балл или неразнесенные неуважительные пропуски:{' '}
                  <span className="font-bold text-rose-900 dark:text-rose-300">{riskStudents.map((s) => s.fullName).join(', ')}</span>.
                </p>
              </div>
            </div>
          )}

          <div className="bg-[var(--card)] rounded-sm border border-[var(--line)] overflow-hidden transition-colors duration-300">
            <div className="p-5 border-b border-[var(--line)] bg-[var(--soft)] flex justify-between items-center">
              <h3 className="font-bold text-stone-900 dark:text-zinc-100 text-base">Сводная ведомость учащихся</h3>
              <button
                onClick={() => setActiveTab('form6')}
                className="text-xs font-bold text-emerald-900 dark:text-amber-300 hover:text-emerald-700 dark:hover:text-amber-200 cursor-pointer"
              >
                Открыть форму № 6 →
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-stone-800 dark:text-zinc-200 uppercase bg-[#F5F2EC] dark:bg-[#1E2128] border-b border-[#D8D1C5] dark:border-[#2E333D]">
                  <tr>
                    <th className="px-5 py-3 font-bold w-12 text-center">№</th>
                    <th className="px-5 py-3 font-bold">ФИО Учащегося</th>
                    <th className="px-5 py-3 font-bold text-center">Подгруппа</th>
                    <th className="px-5 py-3 font-bold text-center">Средний балл</th>
                    <th className="px-5 py-3 font-bold text-center">Уважительные (ч.)</th>
                    <th className="px-5 py-3 font-bold text-center">Неуважительные Н/У (ч.)</th>
                    <th className="px-5 py-3 font-bold text-center">Всего пропусков (ч.)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAE4DC] dark:divide-[#262A32]">
                  {studentsStats.map((student, idx) => (
                    <tr key={student.id} className="hover:bg-[#F3EFE8] dark:hover:bg-[#22262E] transition-colors">
                      <td className="px-5 py-3 text-center text-stone-500 dark:text-zinc-400">{idx + 1}</td>
                      <td className="px-5 py-3 font-medium text-stone-900 dark:text-zinc-100">{student.fullName}</td>
                      <td className="px-5 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold border ${
                          student.subgroup === 1
                            ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-900 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30'
                            : 'bg-rose-100 dark:bg-rose-500/20 text-rose-900 dark:text-rose-300 border-rose-300 dark:border-rose-500/30'
                        }`}>
                          {student.subgroup} п/г
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center font-bold">
                        {student.avg > 0 ? (
                          <span className={`px-2 py-0.5 rounded text-xs border ${
                            student.avg >= 8
                              ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-900 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30'
                              : student.avg >= 5
                                ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-500/30'
                                : 'bg-rose-100 dark:bg-rose-500/20 text-rose-900 dark:text-rose-300 border-rose-300 dark:border-rose-500/30'
                          }`}>
                            {student.avg.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-stone-400 dark:text-zinc-500">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-center font-bold text-emerald-800 dark:text-emerald-400">
                        {student.excusedHours > 0 ? `${student.excusedHours} ч.` : '0'}
                      </td>
                      <td className="px-5 py-3 text-center">
                        {student.unexcusedHours > 0 ? (
                          <span className="px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 font-bold text-xs border border-rose-200 dark:border-rose-500/30">
                            {student.unexcusedHours} ч.
                          </span>
                        ) : (
                          <span className="text-stone-400 dark:text-zinc-500">0</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-center font-bold text-stone-900 dark:text-zinc-100">
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
        <div className="space-y-5">
          {/* Панель реквизитов Формы №6 */}
          <div className="bg-[var(--card)] p-5 rounded-sm border border-[var(--line)] shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 transition-colors duration-300">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 w-full lg:w-auto">
              <div>
                <label className="block text-[11px] font-bold text-stone-600 dark:text-zinc-400 uppercase">Месяц</label>
                <select
                  value={monthName}
                  onChange={(e) => setMonthName(e.target.value)}
                  className="mt-1 w-full px-2.5 py-1.5 text-sm bg-[#F3EFE8] dark:bg-[#22262E] text-stone-900 dark:text-zinc-100 border border-[#D8D1C5] dark:border-[#323844] rounded-lg font-medium outline-none"
                >
                  {['сентябрь', 'октябрь', 'ноябрь', 'декабрь', 'январь', 'февраль', 'март', 'апрель', 'май', 'июнь'].map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-stone-600 dark:text-zinc-400 uppercase">Год</label>
                <input
                  type="text"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="mt-1 w-full px-2.5 py-1.5 text-sm bg-[#F3EFE8] dark:bg-[#22262E] text-stone-900 dark:text-zinc-100 border border-[#D8D1C5] dark:border-[#323844] rounded-lg font-medium outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-stone-600 dark:text-zinc-400 uppercase">Курс</label>
                <input
                  type="number"
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                  className="mt-1 w-full px-2.5 py-1.5 text-sm bg-[#F3EFE8] dark:bg-[#22262E] text-stone-900 dark:text-zinc-100 border border-[#D8D1C5] dark:border-[#323844] rounded-lg font-medium outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-stone-600 dark:text-zinc-400 uppercase">Группа</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="mt-1 w-full px-2.5 py-1.5 text-sm bg-[#F3EFE8] dark:bg-[#22262E] text-stone-900 dark:text-zinc-100 border border-[#D8D1C5] dark:border-[#323844] rounded-lg font-medium outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-stone-600 dark:text-zinc-400 uppercase">Зав. отделением</label>
                <input
                  type="text"
                  value={deptHead}
                  onChange={(e) => setDeptHead(e.target.value)}
                  className="mt-1 w-full px-2.5 py-1.5 text-sm bg-[#F3EFE8] dark:bg-[#22262E] text-stone-900 dark:text-zinc-100 border border-[#D8D1C5] dark:border-[#323844] rounded-lg font-medium outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-stone-600 dark:text-zinc-400 uppercase">Куратор</label>
                <input
                  type="text"
                  value={curatorName}
                  onChange={(e) => setCuratorName(e.target.value)}
                  className="mt-1 w-full px-2.5 py-1.5 text-sm bg-[#F3EFE8] dark:bg-[#22262E] text-stone-900 dark:text-zinc-100 border border-[#D8D1C5] dark:border-[#323844] rounded-lg font-medium outline-none"
                />
              </div>
            </div>

            <button
              onClick={handleDownloadForm6}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#244b3c] hover:bg-emerald-900 text-white text-sm font-bold rounded-sm shadow-sm border border-amber-400/30 transition-all cursor-pointer shrink-0"
            >
              <span>Скачать Форму №6 (.doc)</span>
            </button>
          </div>

          {/* Панель штампа причин и контроля часов */}
          <div className="bg-[var(--card)] p-4 rounded-sm border border-[var(--line)] shadow-sm space-y-3 transition-colors duration-300">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-800 dark:text-amber-300" />
                <span className="text-sm font-bold text-stone-900 dark:text-zinc-100">
                  Причина отсутствия
                </span>
              </div>
              <span className="text-xs text-stone-500 dark:text-zinc-400">
                В скачанном .doc файле в клетках дней будут стоять только цифры часов (без букв)
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {ABSENCE_TYPES.map((type) => (
                <button
                  key={type.code}
                  onClick={() => {
                    setToolAction('stamp');
                    setSelectedReason(type.code);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                    toolAction === 'stamp' && selectedReason === type.code
                      ? `${type.color} ring-2 ring-emerald-700 dark:ring-amber-400 shadow-xs`
                      : 'bg-[#F3EFE8] dark:bg-[#22262E] text-stone-700 dark:text-zinc-300 border-[#D8D1C5] dark:border-[#323844] hover:bg-[#EFECE6] dark:hover:bg-[#2A2F3A]'
                  }`}
                >
                  {type.label}
                </button>
              ))}

              <button
                onClick={() => setToolAction('resetToJournal')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                  toolAction === 'resetToJournal'
                    ? 'bg-[#244b3c] text-white border-amber-400/40 ring-2 ring-emerald-700 dark:ring-amber-400'
                    : 'bg-[#F3EFE8] dark:bg-[#22262E] text-stone-700 dark:text-zinc-300 border-[#D8D1C5] dark:border-[#323844] hover:bg-[#EFECE6] dark:hover:bg-[#2A2F3A]'
                }`}
              >
                <span>Часы из журнала</span>
              </button>

              <button
                onClick={() => setToolAction('eraser')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                  toolAction === 'eraser'
                    ? 'bg-stone-800 dark:bg-zinc-200 text-white dark:text-stone-950 border-stone-900'
                    : 'bg-[#F3EFE8] dark:bg-[#22262E] text-stone-700 dark:text-zinc-300 border-[#D8D1C5] dark:border-[#323844] hover:bg-[#EFECE6] dark:hover:bg-[#2A2F3A]'
                }`}
              >
                <span>Очистить клетку</span>
              </button>
            </div>

            {toolAction === 'stamp' && selectedReason !== 'Сп' && (
              <div className="pt-3 border-t border-[#EAE4DC] dark:border-[#262A32] flex flex-wrap items-center gap-3">
                <span className="text-xs font-bold text-stone-700 dark:text-zinc-300">
                  Количество часов
                </span>

                <button
                  onClick={() => setHoursMode('auto')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                    hoursMode === 'auto'
                      ? 'bg-[#244b3c] text-white border-amber-400/40 shadow-xs'
                      : 'bg-[#F3EFE8] dark:bg-[#22262E] text-stone-700 dark:text-zinc-300 border-[#D8D1C5] dark:border-[#323844] hover:bg-[#EFECE6] dark:hover:bg-[#2A2F3A]'
                  }`}
                >
                  Сохранить часы из журнала
                </button>

                <div className="flex flex-wrap items-center gap-1.5 pl-2 border-l border-[#D8D1C5] dark:border-[#323844]">
                  <span className="text-xs text-stone-600 dark:text-zinc-400 font-medium">Указать вручную</span>
                  {HOURS_PRESETS.map((h) => (
                    <button
                      key={h}
                      onClick={() => {
                        setHoursMode('manual');
                        setCustomHoursInput(h);
                      }}
                      className={`w-7 h-7 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                        hoursMode === 'manual' && Number(customHoursInput) === h
                          ? 'bg-[#244b3c] text-white border-amber-400/40 shadow-xs'
                          : 'bg-[#FAF8F5] dark:bg-[#22262E] text-stone-700 dark:text-zinc-300 border-[#D8D1C5] dark:border-[#323844] hover:bg-[#EFECE6] dark:hover:bg-[#2A2F3A]'
                      }`}
                    >
                      {h}
                    </button>
                  ))}

                  <input
                    type="number"
                    min={1}
                    max={16}
                    aria-label="Количество часов вручную"
                    value={customHoursInput}
                    onFocus={() => setHoursMode('manual')}
                    onChange={(e) => {
                      setHoursMode('manual');
                      setCustomHoursInput(e.target.value);
                    }}
                    className={`w-14 px-2 py-1 text-center text-xs font-bold border rounded-lg outline-none ${
                      hoursMode === 'manual'
                        ? 'border-emerald-800 dark:border-amber-400 ring-2 ring-emerald-700/20 bg-emerald-50/30 dark:bg-[#262B34] text-stone-900 dark:text-zinc-100'
                        : 'border-[#D8D1C5] dark:border-[#323844] bg-[#FAF8F5] dark:bg-[#22262E] text-stone-900 dark:text-zinc-100'
                    }`}
                  />
                  <span className="text-xs text-stone-500 dark:text-zinc-400">ч.</span>
                </div>
              </div>
            )}
          </div>

          {/* Таблица Формы №6 */}
          <div className="bg-[var(--card)] rounded-sm border border-[var(--line)] overflow-hidden transition-colors duration-300">
            <div className="p-4 border-b border-[#D8D1C5] dark:border-[#2E333D] bg-[var(--soft)] text-center space-y-0.5">
              <div className="text-right text-xs font-bold text-stone-500 dark:text-zinc-400">Форма №6</div>
              <h3 className="font-bold text-stone-900 dark:text-zinc-100 text-sm uppercase tracking-wide">
                ВЕДОМОСТЬ учёта учебных часов, пропущенных учащимися УО «ВГТК»
              </h3>
              <p className="text-xs text-stone-700 dark:text-zinc-300">
                за <span className="font-bold underline">{monthName}</span> {year} г. • {course} курс группа <span className="font-bold underline">{groupName}</span>
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse whitespace-nowrap select-none">
                <thead>
                  <tr className="bg-[var(--soft)] text-stone-800 dark:text-zinc-200 border-b border-[#D8D1C5] dark:border-[#2E333D]">
                    <th rowSpan={3} className="border-r border-[#D8D1C5] dark:border-[#2E333D] px-2 py-2 text-center w-10">№</th>
                    <th rowSpan={3} className="border-r border-[#D8D1C5] dark:border-[#2E333D] px-3 py-2 text-left sticky left-0 bg-[var(--soft)] z-10 min-w-[170px]">
                      ФИО учащегося
                    </th>
                    <th colSpan={31} className="border-r border-b border-[#D8D1C5] dark:border-[#2E333D] py-1.5 text-center font-bold">
                      Число месяца
                    </th>
                    <th colSpan={6} className="border-r border-b border-[#D8D1C5] dark:border-[#2E333D] py-1.5 text-center font-bold bg-[#E5DFD3] dark:bg-[#262B34]">
                      Пропуски (часов)
                    </th>
                    <th rowSpan={3} className="px-2.5 py-2 text-center font-extrabold bg-[#DED6C6] dark:bg-[#2A2F3A] text-stone-900 dark:text-zinc-100">
                      ВСЕГО
                    </th>
                  </tr>
                  <tr className="bg-[#F5F2EC] dark:bg-[#1E2128] text-stone-800 dark:text-zinc-200 border-b border-[#D8D1C5] dark:border-[#2E333D]">
                    {daysInMonth.map((day) => (
                      <th key={day} rowSpan={2} className="border-r border-[var(--line)] px-1 py-1 text-center font-bold min-w-[36px]">
                        {day}
                      </th>
                    ))}
                    <th colSpan={5} className="border-r border-b border-[#D8D1C5] dark:border-[#2E333D] py-1 text-center font-bold bg-emerald-100/60 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-300">
                      Уважительные
                    </th>
                    <th rowSpan={2} className="border-r border-[#D8D1C5] dark:border-[#2E333D] px-2 py-1 text-center font-bold bg-rose-100/60 dark:bg-rose-950/40 text-rose-900 dark:text-rose-300">
                      Н/У
                    </th>
                  </tr>
                  <tr className="bg-[#F5F2EC] dark:bg-[#1E2128] text-stone-800 dark:text-zinc-200 border-b border-[#D8D1C5] dark:border-[#2E333D]">
                    <th className="border-r border-[#D8D1C5] dark:border-[#2E333D] px-2 py-1 text-center font-bold">Б</th>
                    <th className="border-r border-[#D8D1C5] dark:border-[#2E333D] px-2 py-1 text-center font-bold">О</th>
                    <th className="border-r border-[#D8D1C5] dark:border-[#2E333D] px-2 py-1 text-center font-bold">З</th>
                    <th className="border-r border-[#D8D1C5] dark:border-[#2E333D] px-2 py-1 text-center font-bold">К</th>
                    <th className="border-r border-[#D8D1C5] dark:border-[#2E333D] px-2 py-1 text-center font-extrabold bg-emerald-100/80 dark:bg-emerald-900/40">Всего</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#EAE4DC] dark:divide-[#262A32]">
                  {students.map((student, idx) => {
                    const totals = getForm6StudentTotals(student.id);

                    return (
                      <tr key={student.id} className="hover:bg-[#F3EFE8] dark:hover:bg-[#22262E] group/row transition-colors">
                        <td className="border-r border-[#EAE4DC] dark:border-[#262A32] px-2 py-1.5 text-center text-stone-500 dark:text-zinc-400">
                          {idx + 1}.
                        </td>
                        <td className="border-r border-[#D8D1C5] dark:border-[#2E333D] px-3 py-1.5 font-medium text-stone-900 dark:text-zinc-100 sticky left-0 bg-[var(--card)] group-hover/row:bg-[#F3EFE8] dark:group-hover/row:bg-[#22262E] z-10 transition-colors">
                          {student.fullName}
                        </td>

                        {daysInMonth.map((day) => {
                          const entry = getCellEntry(student.id, day);
                          const typeMeta = ABSENCE_TYPES.find((t) => t.code === entry?.reason);

                          return (
                            <td
                              key={day}
                              onClick={() => handleCellClick(student.id, day)}
                              className="border-r border-[#EAE4DC] dark:border-[#262A32] p-0.5 text-center cursor-pointer hover:bg-amber-100/50 dark:hover:bg-amber-500/15 transition-colors"
                            >
                              {entry ? (
                                <div className={`w-full py-0.5 px-1 rounded border flex items-center justify-center gap-0.5 ${typeMeta?.color || ''}`}>
                                  {entry.reason === 'Сп' ? (
                                    <span className="text-[10px] font-bold">Сп</span>
                                  ) : (
                                    <>
                                      <span className="text-[11px] font-extrabold leading-none">{entry.hours}</span>
                                      <span className="text-[8px] font-bold opacity-80 leading-none">{entry.reason}</span>
                                    </>
                                  )}
                                </div>
                              ) : (
                                <span className="inline-block w-full h-5" />
                              )}
                            </td>
                          );
                        })}

                        <td className="border-r border-[#EAE4DC] dark:border-[#262A32] px-2 py-1.5 text-center font-bold text-sky-900 dark:text-sky-300 bg-sky-50/30 dark:bg-sky-950/20">
                          {totals['Б'] || ''}
                        </td>
                        <td className="border-r border-[#EAE4DC] dark:border-[#262A32] px-2 py-1.5 text-center font-bold text-amber-900 dark:text-amber-300 bg-amber-50/30 dark:bg-amber-950/20">
                          {totals['О'] || ''}
                        </td>
                        <td className="border-r border-[#EAE4DC] dark:border-[#262A32] px-2 py-1.5 text-center font-bold text-emerald-900 dark:text-emerald-300 bg-emerald-50/30 dark:bg-emerald-950/20">
                          {totals['З'] || ''}
                        </td>
                        <td className="border-r border-[#EAE4DC] dark:border-[#262A32] px-2 py-1.5 text-center font-bold text-teal-900 dark:text-teal-300 bg-teal-50/30 dark:bg-teal-950/20">
                          {totals['К'] || ''}
                        </td>
                        <td className="border-r border-[#D8D1C5] dark:border-[#2E333D] px-2 py-1.5 text-center font-extrabold text-emerald-950 dark:text-emerald-300 bg-emerald-100/50 dark:bg-emerald-950/40">
                          {totals.excusedTotal || 0}
                        </td>
                        <td className="border-r border-[#D8D1C5] dark:border-[#2E333D] px-2 py-1.5 text-center font-extrabold text-rose-800 dark:text-rose-300 bg-rose-100/40 dark:bg-rose-950/40">
                          {totals['Н/У'] || 0}
                        </td>
                        <td className="px-2 py-1.5 text-center font-extrabold text-stone-900 dark:text-zinc-100 bg-[var(--soft)]">
                          {totals.grandTotal || 0}
                        </td>
                      </tr>
                    );
                  })}

                  <tr className="bg-[var(--soft)] font-bold text-stone-900 dark:text-zinc-100 border-t-2 border-[#D8D1C5] dark:border-[#2E333D]">
                    <td colSpan={33} className="border-r border-[#D8D1C5] dark:border-[#2E333D] px-4 py-2 text-right">
                      Всего по группе:
                    </td>
                    <td className="border-r border-[#D8D1C5] dark:border-[#2E333D] px-2 py-2 text-center">{groupForm6Totals['Б']}</td>
                    <td className="border-r border-[#D8D1C5] dark:border-[#2E333D] px-2 py-2 text-center">{groupForm6Totals['О']}</td>
                    <td className="border-r border-[#D8D1C5] dark:border-[#2E333D] px-2 py-2 text-center">{groupForm6Totals['З']}</td>
                    <td className="border-r border-[#D8D1C5] dark:border-[#2E333D] px-2 py-2 text-center">{groupForm6Totals['К']}</td>
                    <td className="border-r border-[#D8D1C5] dark:border-[#2E333D] px-2 py-2 text-center bg-emerald-100/70 dark:bg-emerald-950/50 text-emerald-950 dark:text-emerald-300">
                      {groupForm6Totals.excusedTotal}
                    </td>
                    <td className="border-r border-[#D8D1C5] dark:border-[#2E333D] px-2 py-2 text-center bg-rose-100/70 dark:bg-rose-950/50 text-rose-900 dark:text-rose-300">
                      {groupForm6Totals['Н/У']}
                    </td>
                    <td className="px-2 py-2 text-center bg-[#DED6C6] dark:bg-[#2A2F3A] text-stone-950 dark:text-zinc-100">
                      {groupForm6Totals.grandTotal}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="p-4 bg-[#F5F2EC] dark:bg-[#1E2128] border-t border-[var(--line)] flex flex-col md:flex-row justify-between gap-4 text-xs text-stone-600 dark:text-zinc-400">
              <div className="space-x-6 font-medium text-stone-800 dark:text-zinc-200">
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
