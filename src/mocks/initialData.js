export const currentUser = {
  id: "t1",
  fullName: "Иванов Иван Иванович",
  roles: ["TEACHER", "CURATOR"],
  curatorGroup: "ПО-31",
  course: 3,
  departmentHead: "Н.Е. Дасько",
  curatorShortName: "И.И. Иванов",
  teachingSubjects: [
    {
      id: "j1",
      subjectId: "subj-kp",
      subjectName: "Конструирование программ и языки программирования",
      groupName: "ПО-31",
      isMain: true,
      sheetId: "subj-kp-main"
    },
    {
      id: "j2",
      subjectId: "subj-kp",
      subjectName: "Конструирование программ и языки программирования",
      groupName: "ПО-31",
      isMain: false,
      sheetId: "subj-kp-sub2"
    },
    {
      id: "j3",
      subjectId: "subj-db",
      subjectName: "Базы данных",
      groupName: "ПО-31",
      isMain: true,
      sheetId: "subj-db-main"
    },
    {
      id: "j4",
      subjectId: "subj-web",
      subjectName: "Технология разработки веб-ресурсов",
      groupName: "ПО-31",
      isMain: true,
      sheetId: "subj-web-main"
    }
  ]
};

export const mockStudents = [
  { id: "s1", fullName: "Алексеев Алексей", subgroup: 1, groupName: "ПО-31" },
  { id: "s2", fullName: "Борисов Борис", subgroup: 1, groupName: "ПО-31" },
  { id: "s3", fullName: "Васильев Василий", subgroup: 1, groupName: "ПО-31" },
  { id: "s4", fullName: "Григорьев Григорий", subgroup: 2, groupName: "ПО-31" },
  { id: "s5", fullName: "Дмитриев Дмитрий", subgroup: 2, groupName: "ПО-31" },
  { id: "s6", fullName: "Евгеньев Евгений", subgroup: 2, groupName: "ПО-31" },
];

// Каждое занятие теперь привязано к своему предмету через subjectId
export const mockLessons = [
  // Предмет 1: Конструирование программ (subj-kp)
  { id: "l1", subjectId: "subj-kp", date: "24.10", day: 24, type: "ЛЕК", hours: 2, topic: "Введение в паттерны проектирования", homework: "Конспект лекции", createdByMain: true },
  { id: "l2", subjectId: "subj-kp", date: "27.10", day: 27, type: "ПР", hours: 2, topic: "Реализация паттерна Singleton и Factory", homework: "Практическое задание №1", isSubgroupOnly: true, createdByMain: true },
  { id: "l3", subjectId: "subj-kp", date: "29.10", day: 29, type: "ОК", hours: 1, topic: "Тестирование по принципам SOLID", homework: "Повторить главу 2", createdByMain: true },

  // Предмет 2: Базы данных (subj-db)
  { id: "db1", subjectId: "subj-db", date: "21.10", day: 21, type: "ЛЕК", hours: 2, topic: "Нормализация отношений (1НФ–3НФ)", homework: "Привести схему БД к 3НФ", createdByMain: true },
  { id: "db2", subjectId: "subj-db", date: "26.10", day: 26, type: "ЛАБ", hours: 2, topic: "Сложные SELECT-запросы и JOIN в PostgreSQL", homework: "Отчёт по лабораторной работе №1", isSubgroupOnly: true, createdByMain: true },

  // Предмет 3: Технология разработки веб-ресурсов (subj-web)
  { id: "web1", subjectId: "subj-web", date: "22.10", day: 22, type: "ЛЕК", hours: 2, topic: "Архитектура SPA и компонентный подход в React", homework: "Развернуть проект на Vite + Tailwind", createdByMain: true },
  { id: "web2", subjectId: "subj-web", date: "28.10", day: 28, type: "ЛАБ", hours: 2, topic: "Работа с хуками useState и useEffect", homework: "Лабораторная работа №1", isSubgroupOnly: true, createdByMain: true }
];

// Оценки привязаны к конкретному lessonId (а через него — к нужному предмету)
export const mockGrades = [
  // Оценки по Конструированию программ
  { lessonId: "l1", hourIndex: 1, studentId: "s1", grade: "9", attendance: "PRESENT" },
  { lessonId: "l1", hourIndex: 2, studentId: "s2", grade: "7", attendance: "PRESENT" },
  { lessonId: "l1", hourIndex: 1, studentId: "s4", grade: null, attendance: "ABSENT" },
  { lessonId: "l1", hourIndex: 2, studentId: "s4", grade: null, attendance: "ABSENT" },
  { lessonId: "l2", hourIndex: 1, studentId: "s4", grade: "8", attendance: "PRESENT" },

  // Оценки по Базам данных
  { lessonId: "db1", hourIndex: 1, studentId: "s1", grade: "10", attendance: "PRESENT" },
  { lessonId: "db1", hourIndex: 1, studentId: "s3", grade: "6", attendance: "PRESENT" },
  { lessonId: "db2", hourIndex: 1, studentId: "s2", grade: "8", attendance: "PRESENT" },

  // Оценки по Веб-разработке
  { lessonId: "web1", hourIndex: 1, studentId: "s1", grade: "10", attendance: "PRESENT" },
  { lessonId: "web2", hourIndex: 1, studentId: "s6", grade: "9", attendance: "PRESENT" }
];

// Расписание с правильными ссылками на листы конкретных предметов
export const mockSchedule = {
  today: {
    dateLabel: "Пятница, 30 октября",
    lessons: [
      {
        id: "sch-1",
        hoursCount: 2,
        slots: [
          { num: 1, time: "09.00 - 09.45" },
          { num: 2, time: "09.55 - 10.40" }
        ],
        subject: "Конструирование программ и языки программирования",
        group: "ПО-31",
        room: "308",
        type: "ЛЕК",
        teacher: "Иванов И. И.",
        sheetId: "subj-kp-main",
        isMainSheet: true
      },
      {
        id: "sch-2",
        hoursCount: 2,
        slots: [
          { num: 3, time: "10.50 - 11.35" },
          { num: 4, time: "11.45 - 12.30" }
        ],
        subject: "Конструирование программ и языки программирования",
        group: "ПО-31",
        room: "308/309",
        type: "ПР",
        teacher: "1 п/г: Иванов И. И. / 2 п/г: Петров П. П.",
        sheetId: "subj-kp-sub2",
        isMainSheet: false
      },
      {
        id: "sch-3",
        hoursCount: 1,
        slots: [
          { num: 5, time: "12.40 - 13.25" }
        ],
        subject: "Базы данных",
        group: "ПО-31",
        room: "412",
        type: "УРОК",
        teacher: "Сидорова А. В.",
        sheetId: "subj-db-main",
        isMainSheet: true
      },
      {
        id: "sch-lunch",
        isLunch: true,
        hoursCount: 1,
        slots: [
          { num: 6, time: "13.35 - 14.20" }
        ],
        subject: "Обед",
        group: "ПО-31"
      }
    ]
  },
  tomorrow: {
    dateLabel: "Суббота, 31 октября",
    lessons: [
      {
        id: "sch-5",
        hoursCount: 2,
        slots: [
          { num: 1, time: "09.00 - 09.45" },
          { num: 2, time: "09.55 - 10.40" }
        ],
        subject: "Технология разработки веб-ресурсов",
        group: "ПО-31",
        room: "308/310",
        type: "ЛАБ",
        teacher: "1 п/г: Иванов И. И. / 2 п/г: Козлов Д. С.",
        sheetId: "subj-web-main",
        isMainSheet: true
      }
    ]
  }
};