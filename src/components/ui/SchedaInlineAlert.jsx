/** Banner inline per schede evento/missione/paziente (errori e avvisi persistenti). */
export function SchedaInlineAlert({
  message,
  onDismiss,
  variant = 'error',
  className = '',
  suffix = '',
}) {
  if (!message) return null;
  const styles =
    variant === 'warning'
      ? 'border-amber-200 bg-amber-50 text-amber-950'
      : 'border-red-200 bg-red-50 text-red-900';
  return (
    <div
      className={`flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${styles} ${className}`}
      role={variant === 'warning' ? 'status' : 'alert'}
    >
      <p className="min-w-0 flex-1">
        {message}
        {suffix ? ` ${suffix}` : ''}
      </p>
      {onDismiss ? (
        <button
          type="button"
          className="shrink-0 text-xs font-semibold underline opacity-80 hover:opacity-100"
          onClick={onDismiss}
        >
          Chiudi
        </button>
      ) : null}
    </div>
  );
}
