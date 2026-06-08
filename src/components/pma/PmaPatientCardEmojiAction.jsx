/** Pulsante icona compatto per azioni sulle card paziente dashboard PMA. */
export function PmaPatientCardEmojiAction({
  emoji,
  title,
  onClick,
  disabled = false,
  busy = false,
  primary = false,
}) {
  const label = String(title ?? '').trim();
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled || busy}
      onClick={onClick}
      className={`pma-patient-card__emoji-btn${
        primary ? ' pma-patient-card__emoji-btn--primary' : ''
      }`}
    >
      <span className="pma-patient-card__emoji-btn-icon" aria-hidden="true">
        {busy ? '…' : emoji}
      </span>
    </button>
  );
}

/** Riga orizzontale di azioni emoji sulla card. */
export function PmaPatientCardEmojiActions({ children }) {
  if (!children) return null;
  return <div className="pma-patient-card__emoji-actions">{children}</div>;
}
