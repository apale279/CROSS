import { isSchedaInSolaVisione, isSchedaModificaForzata } from '../../lib/schedaSolaVisione';
import { btnSecondary } from '../ui/FormField';

export function SchedaUnlockBar({ paziente, userRank = null, onToggleModifica, busy = false }) {
  if (!paziente) return null;
  const solaVisione = isSchedaInSolaVisione(paziente, { userRank });
  const modificaForzata = isSchedaModificaForzata(paziente);
  if (!solaVisione && !modificaForzata) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
      {solaVisione ? (
        <>
          <span>Scheda in sola visione (chiusa per centrale o PMA).</span>
          <button
            type="button"
            className={`${btnSecondary} text-xs`}
            disabled={busy}
            onClick={() => onToggleModifica?.(true)}
          >
            Riabilita modifica
          </button>
        </>
      ) : (
        <>
          <span>Modifica riabilitata manualmente.</span>
          <button
            type="button"
            className={`${btnSecondary} text-xs`}
            disabled={busy}
            onClick={() => onToggleModifica?.(false)}
          >
            Blocca modifica
          </button>
        </>
      )}
    </div>
  );
}
