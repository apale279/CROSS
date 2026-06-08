import { useEffect, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { fromDatetimeLocalValue, toDatetimeLocalValue } from '../../lib/datetimeLocal';
import {
  defaultSoreuOraMissione,
  SOREU_ACCOMPAGNATO_OPTS,
  normalizeSoreuCodice,
  toggleSoreuAccompagnato,
} from '../../lib/soreuTrasporto';
import { FormField, inputClass } from '../ui/FormField';
import { SoreuCodiceSelectButtons } from './SoreuCodiceSelectButtons';

const chipBtn = (active) =>
  `rounded-md border px-2 py-1 text-xs font-semibold uppercase ${
    active
      ? 'border-sky-600 bg-sky-100 text-sky-900'
      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
  }`;

function normalizeNumeroDraft(raw) {
  return String(raw ?? '')
    .replace(/\D/g, '')
    .slice(0, 16);
}

/**
 * Campi SOREU: draft locale su testo/data; salvataggio tramite onPatch on blur (o click immediato su chip/codice).
 */
export function SoreuTrasportoFields({ values, onPatch, disabled = false }) {
  const [numeroDraft, setNumeroDraft] = useState(() =>
    normalizeNumeroDraft(values.soreuNumeroMissione),
  );
  const [oraDraft, setOraDraft] = useState(() =>
    toDatetimeLocalValue(values.soreuOraMissione ?? defaultSoreuOraMissione()),
  );
  const [numeroFocused, setNumeroFocused] = useState(false);
  const [oraFocused, setOraFocused] = useState(false);
  const [accompagnato, setAccompagnato] = useState(() => values.soreuAccompagnato ?? ['NO']);
  const [codice, setCodice] = useState(() => normalizeSoreuCodice(values.soreuCodice) || '');

  useEffect(() => {
    if (!numeroFocused) {
      setNumeroDraft(normalizeNumeroDraft(values.soreuNumeroMissione));
    }
  }, [values.soreuNumeroMissione, numeroFocused]);

  useEffect(() => {
    if (!oraFocused) {
      setOraDraft(toDatetimeLocalValue(values.soreuOraMissione ?? defaultSoreuOraMissione()));
    }
  }, [values.soreuOraMissione, oraFocused]);

  useEffect(() => {
    setAccompagnato(values.soreuAccompagnato ?? ['NO']);
  }, [values.soreuAccompagnato]);

  useEffect(() => {
    setCodice(normalizeSoreuCodice(values.soreuCodice) || '');
  }, [values.soreuCodice]);

  const commitNumero = () => {
    setNumeroFocused(false);
    const next = normalizeNumeroDraft(numeroDraft);
    setNumeroDraft(next);
    if (next !== normalizeNumeroDraft(values.soreuNumeroMissione)) {
      onPatch({ soreuNumeroMissione: next });
    }
  };

  const commitOra = () => {
    setOraFocused(false);
    const d = fromDatetimeLocalValue(oraDraft);
    const nextTs = d ? Timestamp.fromDate(d) : null;
    const cur = values.soreuOraMissione ?? null;
    const changed =
      (nextTs?.toMillis?.() ?? null) !== (cur?.toMillis?.() ?? null);
    if (changed) {
      onPatch({ soreuOraMissione: nextTs });
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-sky-200 bg-sky-50/50 p-3">
      <p className="text-xs font-bold uppercase text-sky-900">Dati missione SOREU</p>

      <FormField label="Ora missione SOREU">
        <input
          type="datetime-local"
          className={inputClass}
          disabled={disabled}
          value={oraDraft}
          onFocus={() => setOraFocused(true)}
          onChange={(e) => setOraDraft(e.target.value)}
          onBlur={commitOra}
        />
      </FormField>

      <FormField label="N° missione SOREU">
        <input
          type="text"
          inputMode="numeric"
          className={inputClass}
          disabled={disabled}
          maxLength={16}
          value={numeroDraft}
          onFocus={() => setNumeroFocused(true)}
          onChange={(e) => setNumeroDraft(normalizeNumeroDraft(e.target.value))}
          onBlur={commitNumero}
          placeholder="Es. 12345"
        />
      </FormField>

      <div>
        <p className="mb-1 text-xs font-medium text-slate-600">Accompagnato?</p>
        <div className="flex flex-wrap gap-2">
          {SOREU_ACCOMPAGNATO_OPTS.map((opt) => (
            <button
              key={opt}
              type="button"
              disabled={disabled}
              className={chipBtn(accompagnato.includes(opt))}
              onClick={() => {
                const next = toggleSoreuAccompagnato(accompagnato, opt);
                setAccompagnato(next);
                onPatch({ soreuAccompagnato: next });
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <FormField label="Codice SOREU">
        <SoreuCodiceSelectButtons
          value={codice}
          disabled={disabled}
          onChange={(code) => {
            setCodice(code);
            onPatch({ soreuCodice: code });
          }}
        />
      </FormField>
    </div>
  );
}
