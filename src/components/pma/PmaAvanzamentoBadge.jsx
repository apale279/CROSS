import {
  avanzamentoPmaBadgeClass,
  avanzamentoPmaLabel,
  resolveAvanzamentoPma,
} from '../../lib/pmaAvanzamento';

/** Badge stato avanzamento visita in dashboard PMA. */
export function PmaAvanzamentoBadge({ paziente, className = '' }) {
  if (!paziente) return null;
  try {
    const stato = resolveAvanzamentoPma(paziente);
    const label = avanzamentoPmaLabel(paziente);
    const tone = avanzamentoPmaBadgeClass(stato);

    return (
      <span
        className={`rounded px-1 py-px text-[9px] font-bold uppercase ${tone} ${className}`.trim()}
        title={`Avanzamento: ${label}`}
      >
        {label}
      </span>
    );
  } catch {
    return null;
  }
}
