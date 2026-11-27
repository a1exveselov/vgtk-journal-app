import { useEffect, useState, useSyncExternalStore } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { currentUser } from '../mocks/initialData';
import { createScopedJournalRepository } from '../data/journalRepository';
import { recordOpenedSheet } from '../data/teacherPreferences';
import { readSchedule } from '../data/scheduleRepository';
import { resolveLessonOpening } from '../data/lessonCompletion';
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
      if (!result.ok) refresh();
      // Успешная мутация синхронно обновляет снимок через подписку.
      if (!result.ok) return result;
      if (view.ok) return { ...result, snapshot: view.snapshot };
      return { ok: false, error: { code: 'conflict', message: 'Сохранение нельзя сверить с журналом. Перечитайте данные.' } };
    }
  };
}

function TeacherSheet({ sheetId, intent }) {
  const [store] = useState(() => openTeacherSheet(sheetId));
  const [opening] = useState(() => intent == null ? null : resolveLessonOpening(intent, {
    today: readSchedule('today'), tomorrow: readSchedule('tomorrow'), now: Date.now(),
    sheets: currentUser.teachingSubjects, snapshot: store.getSnapshot().snapshot
  }) ?? { kind: 'invalid' });
  const view = useSyncExternalStore(store.subscribe, store.getSnapshot);
  return <>
    {view.error && <p role="alert">{view.error.message}</p>}
    {view.preferencesError && <p role="status">Открытие листа не добавлено в историю. {view.preferencesError}</p>}
    {opening?.kind === 'invalid' && <p role="status">Переход к занятию не подтверждён. Открыт лист журнала.</p>}
    {view.snapshot && <JournalTable snapshot={view.snapshot} save={store.save} opening={opening} readError={view.error} />}
  </>;
}

export default function JournalSheetPage() {
  const { sheetId } = useParams();
  const { pathname, search, hash, state } = useLocation();
  const navigate = useNavigate();
  const intent = state?.lessonIntent;
  useEffect(() => {
    if (intent !== undefined) navigate(pathname + search + hash, { replace: true, state: null });
  }, [intent, pathname, search, hash, navigate]);
  const known = currentUser.teachingSubjects.some(sheet => sheet.sheetId === sheetId);
  return (
    <div className="sheet-page">
      <Link to="/" className="back-link">← К расписанию</Link>
      {known ? <TeacherSheet key={sheetId} sheetId={sheetId} intent={intent} /> : (
        <header className="sheet-heading"><h1>Журнал не найден</h1></header>
      )}
    </div>
  );
}
