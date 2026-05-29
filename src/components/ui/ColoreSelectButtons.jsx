import { DEFAULT_IMPOSTAZIONI } from '../../constants';
import { parseCodiceColoreOptional } from '../../lib/codiciColore';
import { ColoreIndicator } from './ColoreIndicator';

/**
 * Selettore codici colore con opzione «nessun colore» (M / T senza valore su Firestore).
 */
export function ColoreSelectButtons({
  value,
  onChange,
  colori = DEFAULT_IMPOSTAZIONI.coloriEvento,
  allowNone = true,
  size = 'md',
  noneTitle = 'Nessun colore',
  disabled = false,
}) {
  const selected = parseCodiceColoreOptional(value);

  return (
    <div className={`flex flex-wrap gap-1 ${disabled ? 'pointer-events-none opacity-50' : ''}`}>
      {allowNone ? (
        <button
          type="button"
          title={noneTitle}
          onClick={() => onChange(null)}
          className={`rounded border p-0.5 ${
            !selected ? 'border-sky-600 ring-2 ring-sky-400' : 'border-slate-300'
          }`}
        >
          <ColoreIndicator colore={null} size={size} />
        </button>
      ) : null}
      {colori.map((c) => (
        <button
          key={c}
          type="button"
          title={c}
          onClick={() => onChange(c)}
          className={`rounded border p-0.5 ${
            selected === c ? 'border-sky-600 ring-2 ring-sky-400' : 'border-slate-300'
          }`}
        >
          <ColoreIndicator colore={c} size={size} />
        </button>
      ))}
    </div>
  );
}
