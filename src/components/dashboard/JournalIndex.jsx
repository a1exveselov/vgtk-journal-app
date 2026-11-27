import { useRef, useState } from 'react';
import { ArrowUpRight, Search, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { readTeacherPreferences, setFavoriteSheet } from '../../data/teacherPreferences';

const views = [
  ['all', 'Все'],
  ['favorites', 'Избранные'],
  ['recent', 'Недавние']
];

const emptyMessages = {
  all: 'Доступных журналов пока нет.',
  favorites: 'Здесь появятся журналы, отмеченные звёздочкой.',
  recent: 'Здесь появятся пять последних открытых листов.'
};

const sheetName = sheet => sheet.isMain ? 'Основной лист' : '2-я подгруппа';
const searchText = value => value.trim().toLocaleLowerCase('ru-RU');

export default function JournalIndex({ userId, sheets }) {
  const byId = new Map(sheets.map(sheet => [sheet.sheetId, sheet]));
  const availableIds = new Set(byId.keys());
  const [preferences, setPreferences] = useState(() => readTeacherPreferences(userId, availableIds));
  const [view, setView] = useState('all');
  const [query, setQuery] = useState('');
  const searchRef = useRef(null);
  const favorites = new Set(preferences.value.favorites);
  const candidates = view === 'all' ? availableIds : preferences.value[view];
  const terms = searchText(query).split(/\s+/u).filter(Boolean);
  const visibleSheets = Array.from(candidates, id => byId.get(id)).filter(sheet =>
    sheet && terms.every(term =>
      searchText([sheet.subjectName, sheet.groupName, sheetName(sheet)].join(' ')).includes(term)));

  function clearSearch() {
    setQuery('');
    searchRef.current?.focus();
  }

  return (
    <section className="teacher-journal-index" aria-labelledby="teacher-journal-title">
      <h2 id="teacher-journal-title">Мои журналы</h2>
      <div className="teacher-journal-tools">
        <label htmlFor="teacher-journal-search">Поиск журналов</label>
        <div className="teacher-journal-search">
          <Search aria-hidden="true" size={17} />
          <input id="teacher-journal-search" ref={searchRef} type="text"
            value={query} onChange={event => setQuery(event.target.value)}
            placeholder="Дисциплина, группа или лист" />
          {query && <button type="button" onClick={clearSearch}>Сбросить</button>}
        </div>
        <div className="teacher-journal-views" role="group" aria-label="Список журналов">
          {views.map(([id, label]) => (
            <button key={id} type="button" aria-pressed={view === id} onClick={() => setView(id)}>{label}</button>
          ))}
        </div>
      </div>
      {preferences.error && <p className="teacher-journal-notice" role="status">{preferences.error}</p>}
      {visibleSheets.length ? (
        <ul className="teacher-journal-list">
          {visibleSheets.map(sheet => {
            const { sheetId, subjectName, groupName } = sheet;
            const favorite = favorites.has(sheetId);
            const label = [subjectName, groupName, sheetName(sheet)].join(', ');
            return (
              <li key={sheetId}>
                <Link to={`/journal/${encodeURIComponent(sheetId)}`} aria-label={label}>
                  <span>
                    <strong>{subjectName}</strong>
                    <small>{groupName} · {sheetName(sheet)}</small>
                  </span>
                  <ArrowUpRight aria-hidden="true" size={16} />
                </Link>
                <button type="button" className="teacher-favorite" aria-pressed={favorite}
                  aria-label={`Избранное: ${label}`} title={favorite ? 'Убрать из избранного' : 'В избранное'}
                  onClick={() => setPreferences(setFavoriteSheet(userId, availableIds, sheetId, !favorite))}>
                  <Star aria-hidden="true" size={19} fill={favorite ? 'currentColor' : 'none'} />
                </button>
              </li>
            );
          })}
        </ul>
      ) : <p className="teacher-journal-empty" role="status">
        {terms.length ? 'По запросу ничего не найдено.' : emptyMessages[view]}
      </p>}
    </section>
  );
}
