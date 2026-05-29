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

export function SoreuTrasportoFields({ values, onPatch, disabled = false }) {
  const accompagnato = values.soreuAccompagnato ?? ['NO'];
  const oraTs = values.soreuOraMissione ?? defaultSoreuOraMissione();

  return (
    <div className="space-y-3 rounded-lg border border-sky-200 bg-sky-50/50 p-3">
      <p className="text-xs font-bold uppercase text-sky-900">Dati missione SOREU</p>

      <FormField label="Ora missione SOREU">
        <input
          type="datetime-local"
          className={inputClass}
          disabled={disabled}
          value={toDatetimeLocalValue(oraTs)}
          onChange={(e) => {
            const d = fromDatetimeLocalValue(e.target.value);
            onPatch({ soreuOraMissione: d ? Timestamp.fromDate(d) : null });
          }}
        />
      </FormField>

      <FormField label="N° missione SOREU">
        <input
          type="text"
          inputMode="numeric"
          className={inputClass}
          disabled={disabled}
          maxLength={16}
          value={values.soreuNumeroMissione ?? ''}
          onChange={(e) =>
            onPatch({ soreuNumeroMissione: e.target.value.replace(/\D/g, '').slice(0, 16) })
          }
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
              onClick={() =>
                onPatch({ soreuAccompagnato: toggleSoreuAccompagnato(accompagnato, opt) })
              }
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <FormField label="Codice SOREU">
        <SoreuCodiceSelectButtons
          value={normalizeSoreuCodice(values.soreuCodice) || ''}
          disabled={disabled}
          onChange={(code) => onPatch({ soreuCodice: code })}
        />
      </FormField>
    </div>
  );
}
