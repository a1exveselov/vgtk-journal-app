const keyFor = userId => 'vgtk_ui_teacher_preferences:' + encodeURIComponent(userId);
const emptyPreferences = () => ({ favorites: [], recent: [] });
const recentLimit = 5;

function knownIds(ids, availableIds) {
  return [...new Set(ids)].filter(id => availableIds.has(id));
}

export function readTeacherPreferences(userId, availableIds) {
  let raw;
  try {
    raw = globalThis.localStorage.getItem(keyFor(userId));
  } catch {
    return { value: emptyPreferences(), error: 'Хранилище настроек недоступно.' };
  }
  if (raw === null) return { value: emptyPreferences(), error: null };

  try {
    const saved = JSON.parse(raw);
    if (![saved?.favorites, saved?.recent].every(list =>
      Array.isArray(list) && list.every(id => typeof id === 'string'))) {
      throw new TypeError('Invalid teacher preferences');
    }
    return {
      value: {
        favorites: knownIds(saved.favorites, availableIds),
        recent: knownIds(saved.recent, availableIds).slice(0, recentLimit)
      },
      error: null
    };
  } catch {
    return { value: emptyPreferences(), error: 'Сохранённые настройки рабочего стола повреждены.' };
  }
}

function updatePreferences(userId, availableIds, sheetId, update) {
  const current = readTeacherPreferences(userId, availableIds);
  if (current.error) return current;
  if (!availableIds.has(sheetId)) return { ...current, error: 'Лист отсутствует среди доступных назначений.' };

  const next = update(current.value);
  if (next === current.value) return current;
  try {
    globalThis.localStorage.setItem(keyFor(userId), JSON.stringify(next));
    return { value: next, error: null };
  } catch {
    return { ...current, error: 'Изменения настроек рабочего стола не сохранены.' };
  }
}

export function setFavoriteSheet(userId, availableIds, sheetId, favorite) {
  return updatePreferences(userId, availableIds, sheetId, value => {
    if (value.favorites.includes(sheetId) === favorite) return value;
    const favorites = favorite ? [...value.favorites, sheetId] : value.favorites.filter(id => id !== sheetId);
    return { ...value, favorites };
  });
}

export function recordOpenedSheet(userId, availableIds, sheetId) {
  return updatePreferences(userId, availableIds, sheetId, value => {
    if (value.recent[0] === sheetId) return value;
    const recent = [sheetId, ...value.recent.filter(id => id !== sheetId)].slice(0, recentLimit);
    return { ...value, recent };
  });
}
