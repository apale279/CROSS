import {
  STATO_PZ_PMA,
  isPazienteOriginePma,
  pazienteHaDestinazionePma,
  pazientePmaAperto,
  pazientePmaChiuso,
  statoPzPmaLabel,
} from '../../lib/pmaModule';
import { chiusuraCentraleLabel, statoCentraleLabel } from '../../lib/pazienteStati';

/** Sezione PMA sulla scheda paziente (vista centrale; nascosta in vista tenda). */
export function PmaPazientePanel({ paziente, pmaNome, compact = false }) {
  if (!pazienteHaDestinazionePma(paziente) && !isPazienteOriginePma(paziente)) return null;

  if (compact) return null;

  const statoLabel = statoPzPmaLabel(paziente.statoPzPma);
  const statoHint = !paziente.statoPzPma
    ? '— (in attesa mezzo DIRETTO H)'
    : pazientePmaChiuso(paziente)
      ? 'Chiuso per il PMA'
      : pazientePmaAperto(paziente)
        ? 'Attivo in tenda'
        : '—';

  return (
    <section className="rounded-lg border border-slate-300 bg-slate-50 p-4 sm:col-span-2">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-600">Modulo PMA</p>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        {!isPazienteOriginePma(paziente) && (
          <div>
            <dt className="text-xs font-medium text-slate-500">Stato centrale (missione)</dt>
            <dd className="font-semibold text-slate-800">
              {statoCentraleLabel(paziente)}
              {chiusuraCentraleLabel(paziente) && (
                <span className="ml-1 text-xs font-normal text-slate-500">
                  — {chiusuraCentraleLabel(paziente)}
                </span>
              )}
            </dd>
          </div>
        )}
        <div>
          <dt className="text-xs font-medium text-slate-500">PMA destinazione</dt>
          <dd className="font-semibold text-slate-900">{pmaNome ?? paziente.ospedaleDestinazione ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-500">Stato PMA (tenda)</dt>
          <dd className="font-semibold text-violet-900">{statoLabel ?? statoHint}</dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-slate-600">
        Due livelli distinti: la centrale chiude la missione (<strong>ARRIVATO H</strong>,{' '}
        <strong>aperta: false</strong>); il PMA ha il proprio ciclo (
        <strong>{STATO_PZ_PMA.IN_ARRIVO}</strong> → <strong>{STATO_PZ_PMA.IN_CARICO}</strong> →{' '}
        <strong>{STATO_PZ_PMA.DIMESSO}</strong>).
      </p>
    </section>
  );
}
