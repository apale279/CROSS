import { isPazienteOriginePma, statoPzPmaLabel } from '../../lib/pmaModule';

/** Card compatta sidebar PMA (in arrivo / in attesa). */
export function PmaPatientReadonlyCard({ paziente, highlight, onOpen, footer }) {
  const isAutopresentato = isPazienteOriginePma(paziente);
  const statoPma = statoPzPmaLabel(paziente.statoPzPma) ?? '—';

  const inner = (
    <article
      className={`rounded-lg border bg-white p-3 text-sm shadow-sm ${
        highlight ? 'border-sky-400 ring-2 ring-sky-200' : 'border-slate-200'
      }`}
    >
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <span className="font-mono text-xs font-bold text-teal-800">{paziente.idPaziente}</span>
        {isAutopresentato ? (
          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-900">
            Auto
          </span>
        ) : (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-900">
            Centrale
          </span>
        )}
        <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-sky-900">
          {statoPma}
        </span>
      </div>
      <p className="font-semibold leading-snug text-slate-900">
        {[paziente.cognome, paziente.nome].filter(Boolean).join(' ') || 'Senza nome'}
      </p>
      {!isAutopresentato && paziente.mezzo && (
        <p className="mt-1 text-xs text-slate-500">Mezzo {paziente.mezzo}</p>
      )}
      {footer}
    </article>
  );

  if (onOpen) {
    return (
      <button type="button" className="w-full text-left" onClick={onOpen}>
        {inner}
      </button>
    );
  }

  return inner;
}
