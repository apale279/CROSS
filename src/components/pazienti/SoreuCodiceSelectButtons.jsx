import { ColoreIndicator } from '../ui/ColoreIndicator';
import { SOREU_CODICE_OPTS, normalizeSoreuCodice } from '../../lib/soreuTrasporto';

const SOREU_TO_COLORE = {
  B: 'Bianco',
  V: 'Verde',
  G: 'Giallo',
  R: 'Rosso',
};

export function SoreuCodiceSelectButtons({ value, onChange, disabled = false }) {
  const selected = normalizeSoreuCodice(value);

  return (
    <div
      className={`flex flex-wrap gap-1.5 ${disabled ? 'pointer-events-none opacity-50' : ''}`}
      role="group"
      aria-label="Codice colore SOREU"
    >
      {SOREU_CODICE_OPTS.map((code) => (
        <button
          key={code}
          type="button"
          disabled={disabled}
          title={`Codice ${code}`}
          aria-pressed={selected === code}
          onClick={() => onChange(code)}
          className={`inline-flex flex-col items-center gap-0.5 rounded border p-0.5 ${
            selected === code ? 'border-sky-600 ring-2 ring-sky-400' : 'border-slate-300'
          }`}
        >
          <ColoreIndicator colore={SOREU_TO_COLORE[code]} size="md" />
          <span className="font-mono text-[10px] font-bold leading-none text-slate-700">{code}</span>
        </button>
      ))}
    </div>
  );
}
