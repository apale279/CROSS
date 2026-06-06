import { useState } from 'react';

/**
 * Textarea con stato locale in modifica: evita che snapshot Firestore
 * sovrascrivano il testo mentre l'operatore digita (commit su blur).
 */
export function BlurCommitTextarea({
  value,
  onCommit,
  className,
  rows = 2,
  disabled = false,
  placeholder,
}) {
  const [draft, setDraft] = useState(null);
  const editing = draft !== null;
  const server = value ?? '';
  const display = editing ? draft : server;

  return (
    <textarea
      className={className}
      rows={rows}
      disabled={disabled}
      placeholder={placeholder}
      value={display}
      onFocus={() => setDraft(server)}
      onBlur={() => {
        const next = draft ?? display;
        setDraft(null);
        if (next !== server) onCommit(next);
      }}
      onChange={(e) => setDraft(e.target.value)}
    />
  );
}
