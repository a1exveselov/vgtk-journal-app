import { useState, useSyncExternalStore } from 'react';
import { Link, useParams } from 'react-router-dom';
import { currentUser } from '../mocks/initialData';
import { createScopedJournalRepository } from '../data/journalRepository';
import { recordOpenedSheet } from '../data/teacherPreferences';
import JournalTable from '../components/journal/JournalTable';

function openTeacherSheet(sheetId) {
  const repository = createScopedJournalRepository();
  let view = repository.read({ sheetId });
  let recordedOpening = false;
  let preferencesError = null;
  const listeners = new Set();
  function refresh() {
    const next = repository.read({ sheetId });
    if (next.ok && next.snapshot.sheet?.sheetId === sheetId && !recordedOpening) {
      recordedOpening = true;
      const availableIds = new Set(currentUser.teachingSubjects.map(sheet => sheet.sheetId));
      preferencesError = recordOpenedSheet(currentUser.id, availableIds, sheetId).error;
    }
    // Открытая форма сохраняет свой черновик, пока хранилище недоступно.
    view = { ...next, snapshot: next.ok ? next.snapshot : view.snapshot, preferencesError };
    for (const listener of listeners) listener();
  }
  return {
    getSnapshot: () => view,
    subscribe(listener) {
      listeners.add(listener);
      const unsubscribe = repository.subscribe(refresh);
      refresh();
      return () => {
        listeners.delete(listener);
        unsubscribe();
      };
    },
    save(base, command) {
      const result = repository.mutate(base, command);
      // Успешная мутация синхронно уведомляет подписчиков репозитория.
      if (!result.ok) refresh();
      return result;
    }
  };
}

function TeacherSheet({ sheetId }) {
  const [store] = useState(() => openTeacherSheet(sheetId));
  const view = useSyncExternalStore(store.subscribe, store.getSnapshot);
  return <>
    {view.error && <p role="alert">{view.error.message}</p>}
    {view.preferencesError && <p role="status">Открытие листа не добавлено в историю. {view.preferencesError}</p>}
    {view.snapshot && <JournalTable snapshot={view.snapshot} save={store.save} />}
  </>;
}

export default function JournalSheetPage() {
  const { sheetId } = useParams();
  const known = currentUser.teachingSubjects.some(sheet => sheet.sheetId === sheetId);
  return (
    <div className="sheet-page">
      <Link to="/" className="back-link">← К расписанию</Link>
      {known ? <TeacherSheet key={sheetId} sheetId={sheetId} /> : (
        <header className="sheet-heading"><h1>Журнал не найден</h1></header>
      )}
    </div>
  );
}
