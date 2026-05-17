import { FormField } from '../ui/FormField';

/**
 * Selezione mezzo per una valutazione (sigle missioni aperte sull’evento).
 */
export function ValutazioneMezzoButtons({ mezziSigle = [], value = '', onChange, className = '' }) {
  const sigle = mezziSigle.filter(Boolean);
  if (!sigle.length) {
    return (
      <p className={`text-xs text-amber-800 ${className}`}>
        Nessun mezzo con missione aperta su questo evento.
      </p>
    );
  }

  return (
    <FormField label="Mezzo" className={className}>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Mezzo valutazione">
        {sigle.map((sigla) => {
          const active = value === sigla;
          return (
            <button
              key={sigla}
              type="button"
              className={`rounded-md border px-3 py-1.5 font-mono text-sm font-bold uppercase ${
                active
                  ? 'border-teal-600 bg-teal-600 text-white shadow-sm'
                  : 'border-slate-300 bg-white text-slate-800 hover:border-teal-400 hover:bg-teal-50'
              }`}
              aria-pressed={active}
              onClick={() => onChange(sigla)}
            >
              {sigla}
            </button>
          );
        })}
      </div>
    </FormField>
  );
}
