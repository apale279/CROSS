import { isSchedaInSolaVisione, isSchedaModificaForzata } from '../../lib/schedaSolaVisione';
import { btnSecondary } from '../ui/FormField';

export function SchedaUnlockBar({ paziente, onToggleModifica, busy = false, compact = false }) {
  if (!paziente) return null;
  const solaVisione = isSchedaInSolaVisione(paziente);
  const modificaForzata = isSchedaModificaForzata(paziente);
  if (!solaVisione && !modificaForzata) return null;

  const label = solaVisione ? 'Sblocca scheda' : 'Blocca scheda';

  return (
    <button
      type="button"
      className={`${btnSecondary} font-semibold ${compact ? 'px-2 py-0.5 text-[11px]' : 'text-xs'}`}
      disabled={busy}
      onClick={() => onToggleModifica?.(solaVisione ? true : false)}
    >
      {label}
    </button>
  );
}
