function failure(code, key, message) {
  return { ok: false, error: { code, key, message: `${key}: ${message}` } };
}

export function createStorage(definitions, getStorage = () => window.localStorage) {
  function read(name) {
    const { key, defaultValue, valid } = definitions[name];
    let raw;
    try {
      raw = getStorage().getItem(key);
    } catch {
      return failure('read', key, 'не удалось прочитать хранилище.');
    }
    if (raw === null) return { ok: true, value: defaultValue, raw };
    try {
      const value = JSON.parse(raw);
      if (valid(value)) return { ok: true, value, raw };
    } catch {
      // Ошибка синтаксиса и неподходящая структура требуют исправления исходных данных.
    }
    return failure('invalid', key, 'повреждены данные журнала. Исходная запись сохранена.');
  }

  function write(changes, expected = {}) {
    const pending = [];
    for (const [name, value] of Object.entries(changes)) {
      const { key, valid } = definitions[name];
      const previous = read(name);
      if (!previous.ok) return previous;
      if (Object.hasOwn(expected, name) && previous.raw !== expected[name]) {
        return failure('conflict', key, 'данные изменились. Проверьте актуальную запись и повторите действие.');
      }
      try {
        const raw = JSON.stringify(value);
        if (!valid(JSON.parse(raw))) throw new TypeError();
        if (raw !== previous.raw) pending.push({ key, raw, previous: previous.raw });
      } catch {
        return failure('invalid-input', key, 'не удалось подготовить данные к сохранению.');
      }
    }
    const written = [];
    for (const item of pending) {
      try {
        getStorage().setItem(item.key, item.raw);
        written.push(item);
      } catch {
        // Восстанавливаем только записи этой операции, пока их значение ещё наше.
        try {
          for (const entry of written.reverse()) {
            const storage = getStorage();
            if (storage.getItem(entry.key) !== entry.raw) throw new Error();
            if (entry.previous === null) storage.removeItem(entry.key);
            else storage.setItem(entry.key, entry.previous);
          }
        } catch {
          return failure('partial', item.key, 'сохранена только часть изменений. Проверьте записи журнала.');
        }
        return failure('write', item.key, 'изменения не сохранены. Проверьте доступ и свободное место.');
      }
    }
    return { ok: true };
  }
  return { read, write };
}
