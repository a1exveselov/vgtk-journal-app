# Карта существующих исходников

Основание: архив el-journal-architecture-2026-11-25.zip, каталог project/; базовый коммит из сопроводительного текста bf9283321cc22e1739aa6712c727178f47acfaf3, архив также содержит незакоммиченные изменения. Это не актуальная проверка живого репозитория.

- `src/App.jsx` — маршруты, верхняя навигация и тема
- `src/pages/TeacherDashboard.jsx` — рабочий стол и список журналов
- `src/pages/JournalSheetPage.jsx` — разрешение sheetId
- `src/components/dashboard/ScheduleWidget.jsx` — общий виджет расписания
- `src/components/journal/JournalTable.jsx` — занятия, отметки, подгруппы, темы, встроенные работы
- `src/components/journal/JournalCell.jsx` — пустой файл — точка выделения ячейки
- `src/components/journal/AddLessonModal.jsx` — создание, изменение, удаление занятия и предупреждение задней даты
- `src/components/journal/lessonDate.js` — разбор дат, жёсткий 2026 для DD.MM
- `src/components/journal/SubgroupManagerModal.jsx` — назначение подгрупп
- `src/components/journal/WorkCompletionModule.jsx` — учёт работ и конфиг
- `src/components/curator/CuratorDashboard.jsx` — обзор, причины, форма №6 и .doc
- `src/components/student/StudentDashboard.jsx` — личные оценки, работы, темы, посещаемость и расписание
- `src/mocks/initialData.js` — демопрофиль и моки
- `src/journal.css` — токены и оформление
- `src/index.css` — Tailwind и смена темы
- `src/context/ThemeContext.jsx` — провайдер темы
- `src/context/useTheme.js` — хук темы
- `src/components/ui/ThemeToggle.jsx` — переключатель темы
- `src/components/ui/JournalDialog.jsx` — нативный dialog

Новые пути перечислены в N конкретных задач. Не создавать весь каталог заранее. Пустые AdminPage/LoginPage/CuratorPage/StudentPage пока вне области; не переносить рабочие компоненты в них.
