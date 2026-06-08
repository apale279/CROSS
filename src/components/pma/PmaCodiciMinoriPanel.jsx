import { useMemo } from 'react';
import { formatTimestamp } from '../../utils/formatters';
import { codiceMinoreFromPaziente } from '../../services/pmaCodiceMinoreService';
import { PmaCodiciMinoriTabellaFotoStrip } from './PmaCodiciMinoriTabellaFotoStrip';

const thClass =
  'sticky top-0 z-10 bg-slate-100 px-2 py-1.5 text-left text-[11px] font-bold uppercase text-slate-600';
const tdClass = 'border-t border-slate-200 px-2 py-1.5 align-middle text-sm text-slate-900';

export function PmaCodiciMinoriPanel({
  rows,
  busy,
  manifestationId,
  pmaId,
  impostazioni,
  onOpenRow,
}) {
  const sorted = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const cmA = codiceMinoreFromPaziente(a);
        const cmB = codiceMinoreFromPaziente(b);
        const chiusoA = cmA.oraFine != null ? 1 : 0;
        const chiusoB = cmB.oraFine != null ? 1 : 0;
        if (chiusoA !== chiusoB) return chiusoA - chiusoB;
        const ta = cmA.oraArrivo?.toMillis?.() ?? 0;
        const tb = cmB.oraArrivo?.toMillis?.() ?? 0;
        return tb - ta;
      }),
    [rows],
  );

  return (
    <div className="min-w-0 space-y-4">
      <p className="min-w-0 max-w-prose text-sm text-slate-600">
        Astanteria fast track: i pazienti entrano qui con «Rendi codice minore» dal desk PMA.
        Clicca una riga per aprire anagrafica e chiudere il trattamento.
      </p>

      {sorted.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
          Nessun codice minore registrato.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[520px] border-collapse">
            <thead>
              <tr>
                <th className={thClass}>Ora CM</th>
                <th className={thClass}>Pett.</th>
                <th className={thClass}>Nome</th>
                <th className={thClass}>Cognome</th>
                <th className={thClass}>Ora fine</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => {
                const cm = codiceMinoreFromPaziente(row);
                return (
                  <tr
                    key={row._docId}
                    className="cursor-pointer hover:bg-violet-50/80"
                    onClick={() => onOpenRow?.(row)}
                  >
                    <td className={`${tdClass} whitespace-nowrap font-mono text-xs`}>
                      {formatTimestamp(cm.oraArrivo)}
                    </td>
                    <td className={`${tdClass} font-mono font-bold`}>{row.pettorale ?? '—'}</td>
                    <td className={tdClass}>{cm.nome || '—'}</td>
                    <td className={tdClass}>{cm.cognome || '—'}</td>
                    <td className={`${tdClass} whitespace-nowrap font-mono text-xs`}>
                      {cm.oraFine ? formatTimestamp(cm.oraFine) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <PmaCodiciMinoriTabellaFotoStrip
        manifestationId={manifestationId}
        pmaId={pmaId}
        impostazioni={impostazioni}
        busy={busy}
        onFotoChange={() => {}}
      />
    </div>
  );
}
