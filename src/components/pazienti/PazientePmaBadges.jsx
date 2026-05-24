import {
  STATO_PZ_PMA,
  TIPO_PZ,
  normalizeStatoPzPma,
  pazienteHaDestinazionePma,
  pazienteHaSchedaPma,
  statoPzPmaLabel,
} from '../../lib/pmaModule';

export function PazientePmaBadges({ paziente }) {
  if (!pazienteHaSchedaPma(paziente)) return null;

  const isAutopresentato = paziente.tipoPz === TIPO_PZ.PMA;
  const inviatoPma = pazienteHaDestinazionePma(paziente) && !isAutopresentato;
  const stato = normalizeStatoPzPma(paziente.statoPzPma);
  const statoLabel = statoPzPmaLabel(paziente.statoPzPma);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {isAutopresentato && (
        <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-900">
          PMA
        </span>
      )}
      {inviatoPma && (
        <span className="rounded bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase text-violet-900">
          → PMA
        </span>
      )}
      {statoLabel && (
        <span
          className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
            stato === STATO_PZ_PMA.DIMESSO
              ? 'bg-slate-200 text-slate-700'
              : 'bg-amber-100 text-amber-900'
          }`}
        >
          {statoLabel}
        </span>
      )}
      {inviatoPma && !stato && (
        <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
          In attesa trasporto
        </span>
      )}
    </div>
  );
}
