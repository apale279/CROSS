import { findEvento } from '../../lib/eventoLinks';
import {
  displayEventoPazienteInLista,
  isPazienteCodiceMinore,
  pazienteHaDestinazionePma,
  pazientePassatoDalPma,
} from '../../lib/pmaModule';
import { displayStatoPazienteInLista, pazienteChiusuraAt } from '../../lib/pazienteStati';
import { formatTimestamp } from '../../utils/formatters';
import { PazientePmaBadges } from './PazientePmaBadges';

/** Elenco pazienti a card per operatori PMA su smartphone/tablet. */
export function PazientiMobileList({ rows, eventi, onRow, emptyLabel }) {
  if (rows.length === 0) {
    return <p className="rounded border border-slate-200 bg-white p-4 text-sm text-slate-500">{emptyLabel}</p>;
  }

  return (
    <ul className="space-y-2">
      {rows.map((row) => {
        const ev = findEvento(eventi, row.eventoIdUnivoco ?? row.eventoCorrelato);
        const eventoLabel = displayEventoPazienteInLista(row, ev);
        const nome = isPazienteCodiceMinore(row)
          ? `Pettorale ${row.pettorale ?? '—'}`
          : [row.cognome, row.nome].filter(Boolean).join(' ') || '—';
        const pma = pazientePassatoDalPma(row);
        const chiusura = pazienteChiusuraAt(row);

        return (
          <li key={row._docId}>
            <button
              type="button"
              onClick={() => onRow(row)}
              className={`flex w-full min-h-[56px] flex-col gap-1 rounded-lg border px-3 py-3 text-left active:bg-sky-50 ${
                pma
                  ? 'border-violet-400 border-l-4 bg-violet-50/70'
                  : 'border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-mono text-base font-bold text-teal-800">{row.idPaziente}</span>
                <PazientePmaBadges paziente={row} />
              </div>
              <span className="text-sm font-medium text-slate-800">{nome}</span>
              <span className="text-xs text-slate-600">
                {displayStatoPazienteInLista(row)}
                {eventoLabel ? ` · ${eventoLabel}` : ''}
              </span>
              {chiusura ? (
                <span className="text-xs text-slate-500">Chiusura: {formatTimestamp(chiusura)}</span>
              ) : null}
              {pazienteHaDestinazionePma(row) ? (
                <span className="text-[10px] font-medium uppercase text-sky-700">Apri scheda PMA</span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
