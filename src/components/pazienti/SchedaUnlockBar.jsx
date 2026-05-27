import { isSchedaInSolaVisione, isSchedaModificaForzata } from '../../lib/schedaSolaVisione';
import { btnSecondary } from '../ui/FormField';

export function SchedaUnlockBar({ paziente, onToggleModifica, busy = false, compact = false }) {
  if (!paziente) return null;
  const solaVisione = isSchedaInSolaVisione(paziente);
  const modificaForzata = isSchedaModificaForzata(paziente);
  if (!solaVisione && !modificaForzata) return null;

  if (compact) {
    return (
      <div className="mx-3 flex items-center justify-between gap-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] leading-tight text-amber-950">
        <span className="min-w-0 truncate">
          {solaVisione ? 'Scheda in sola visione' : 'Modifica sbloccata'}
        </span>
        <button
          type="button"
          className={`${btnSecondary} shrink-0 px-2 py-0.5 text-[11px] font-semibold`}
          disabled={busy}
          onClick={() => onToggleModifica?.(solaVisione ? true : false)}
        >
          {solaVisione ? 'Sblocca' : 'Blocca'}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
      {solaVisione ? (
        <>
          <span>
            Scheda in sola visione (chiusa per centrale o PMA). Per modificare un paziente dimesso,
            sblocca la scheda.
          </span>
          <button
            type="button"
            className={`${btnSecondary} text-xs font-semibold`}
            disabled={busy}
            onClick={() => onToggleModifica?.(true)}
          >
            Sblocca modifica
          </button>
        </>
      ) : (
        <>
          <span>Modifica sbloccata manualmente (centrale e PMA).</span>
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
