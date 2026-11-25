import { useEffect, useRef } from 'react';

export default function JournalDialog({ children, titleId, onDismiss, wide = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  return (
    <dialog ref={ref} aria-labelledby={titleId} className={wide ? 'journal-dialog wide-dialog' : 'journal-dialog'}
      onCancel={(event) => { event.preventDefault(); onDismiss(); }}>
      {children}
    </dialog>
  );
}
