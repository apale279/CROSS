import { STATI_MISSIONE_NUMERATI } from '../../lib/tacticalStatiMissione';

/** Pulsantini 0…n per cambio stato missione dalla sidebar tattica. */
export function EventoStatoRapidoButtons({ missione, onStato, disabled }) {
  if (!missione) return null;

  const currentIdx = STATI_MISSIONE_NUMERATI.indexOf(missione.stato ?? '');

  return (
    <div
      className="mt-1 flex flex-wrap gap-0.5"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {STATI_MISSIONE_NUMERATI.map((stato, i) => {
        const active = currentIdx === i;
        return (
          <button
            key={stato}
            type="button"
            disabled={disabled}
            title={stato}
            onClick={() => onStato?.(stato)}
            className={`flex h-4 min-w-[1.1rem] items-center justify-center rounded border px-0.5 font-mono text-[9px] font-bold leading-none ${
              active
                ? 'border-sky-700 bg-sky-600 text-white'
                : 'border-slate-300 bg-white text-slate-700 hover:border-sky-400 hover:bg-sky-50'
            } disabled:opacity-40`}
          >
            {i}
          </button>
        );
      })}
    </div>
  );
}
