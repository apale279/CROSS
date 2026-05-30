import {
  STATO_PZ_PMA,
  TIPO_PZ,
  isPazienteCodiceMinore,
  normalizeStatoPzPma,
  pazienteHaDestinazionePma,
  pazienteHaSchedaPma,
  statoPzPmaLabel,
} from '../../lib/pmaModule';

export function PazientePmaBadges({ paziente }) {
  if (isPazienteCodiceMinore(paziente)) {
    return (
      <span className="rounded border border-teal-300 bg-teal-100 px-2 py-1 text-[11px] font-bold uppercase text-teal-950 shadow-sm">
        PMA · Codice minore
      </span>
    );
  }

  if (!pazienteHaSchedaPma(paziente)) return null;

  const isAutopresentato = paziente.tipoPz === TIPO_PZ.PMA;
  const inviatoPma = pazienteHaDestinazionePma(paziente) && !isAutopresentato;
  const stato = normalizeStatoPzPma(paziente.statoPzPma);
  const statoLabel = statoPzPmaLabel(paziente.statoPzPma);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {isAutopresentato && (
        <span className="rounded border border-emerald-300 bg-emerald-100 px-2 py-1 text-[11px] font-bold uppercase text-emerald-950 shadow-sm">
          PMA
        </span>
      )}
      {inviatoPma && (
        <span className="rounded border border-violet-400 bg-violet-200 px-2 py-1 text-[11px] font-bold uppercase text-violet-950 shadow-sm">
          → PMA
        </span>
      )}
      {statoLabel && (
        <span
          className={`rounded border px-2 py-1 text-[11px] font-bold uppercase shadow-sm ${
            stato === STATO_PZ_PMA.DIMESSO
              ? 'border-slate-300 bg-slate-200 text-slate-800'
              : 'border-amber-300 bg-amber-100 text-amber-950'
          }`}
        >
          {statoLabel}
        </span>
      )}
      {inviatoPma && !stato && (
        <span className="rounded border border-slate-300 bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700">
          In attesa trasporto
        </span>
      )}
    </div>
  );
}
