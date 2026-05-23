import { STATO_PZ_PMA_LABEL, pazienteHaDestinazionePma } from '../../lib/pmaModule';

/** Sezione PMA sulla scheda paziente centrale (moduli estesi in seguito). */
export function PmaPazientePanel({ paziente, pmaNome }) {
  if (!pazienteHaDestinazionePma(paziente)) return null;

  const stato = paziente.statoPzPma;
  const statoLabel = stato ? STATO_PZ_PMA_LABEL[stato] ?? stato : '— (in attesa mezzo DIRETTO H)';

  return (
    <section className="rounded-lg border border-violet-200 bg-violet-50/40 p-4">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-violet-900">
        Modulo PMA
      </p>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium text-slate-500">PMA destinazione</dt>
          <dd className="font-semibold text-slate-900">{pmaNome ?? paziente.ospedaleDestinazione ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-500">Stato PMA</dt>
          <dd className="font-semibold text-violet-900">{statoLabel}</dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-slate-600">
        Il paziente resta gestito dalla centrale (stati missione e trasporto). In vista PMA compare in
        sola lettura quando il mezzo è in <strong>DIRETTO H</strong>, poi <strong>in carico</strong> ad
        ARRIVATO H.
      </p>
    </section>
  );
}
