import { useEffect } from 'react';

/**
 * Messaggio di conferma salvataggio (scompare dopo `durationMs`).
 */
export function SaveFeedback({ message, onClear, durationMs = 3500 }) {
  useEffect(() => {
    if (!message) return undefined;
    const t = setTimeout(() => onClear?.(), durationMs);
    return () => clearTimeout(t);
  }, [message, durationMs, onClear]);

  if (!message) return null;

  return (
    <p
      role="status"
      className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800"
    >
      {message}
    </p>
  );
}
