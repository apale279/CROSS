import { DEFAULT_IMPOSTAZIONI } from '../../constants';
import {
  ESITI_MSB,
  MR_OPTIONS,
  normalizeMsbDetails,
  toggleMeccanica,
} from '../../lib/msbValutazione';
import { ColoreIndicator } from '../ui/ColoreIndicator';
import { FormField, inputClass, selectClass } from '../ui/FormField';

const avpuOpts = ['A', 'V', 'P', 'U'];

export function MsbValutazioneForm({ msbDetails, onPatch, ospedali, mezziEventoSigle }) {
  const d = normalizeMsbDetails(msbDetails);
  const transportato = d.esitoMsb === 'Trasportato';
  const altro = d.esitoMsb === 'Altro';

  return (
    <div className="space-y-3 border-l-2 border-teal-300 pl-3">
      <FormField label="AVPU">
        <select
          className={selectClass}
          value={d.avpu}
          onChange={(e) => onPatch({ avpu: e.target.value })}
        >
          {avpuOpts.map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="FR">
        <input
          type="number"
          className={inputClass}
          value={d.fr}
          onChange={(e) => onPatch({ fr: Number(e.target.value) })}
        />
      </FormField>

      <div>
        <p className="mb-1 text-xs font-medium text-slate-600">Meccanica respiratoria</p>
        <div className="flex flex-wrap gap-2">
          {MR_OPTIONS.map((opt) => {
            const active = opt.path
              ? (d.meccanicaRespiratoria ?? []).includes(opt.key)
              : (d.meccanicaRespiratoria ?? []).includes('Eupnoico');
            return (
              <button
                key={opt.key}
                type="button"
                className={`rounded-md border px-2 py-1 text-xs font-semibold uppercase ${
                  active
                    ? 'border-teal-600 bg-teal-100 text-teal-900'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
                onClick={() =>
                  onPatch({
                    meccanicaRespiratoria: toggleMeccanica(
                      d.meccanicaRespiratoria ?? [],
                      opt.key,
                    ),
                  })
                }
              >
                {opt.key}
              </button>
            );
          })}
        </div>
        <p className="mt-1 text-[10px] text-slate-500">
          Eupnoico si esclude se selezioni una condizione patologica.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="SpO2 AA (< 101)">
          <input
            type="number"
            max={100}
            min={0}
            className={inputClass}
            value={d.spo2Aa}
            onChange={(e) =>
              onPatch({ spo2Aa: Math.min(100, Math.max(0, Number(e.target.value))) })
            }
          />
        </FormField>
        <FormField label="SpO2 O2 (< 101)">
          <input
            type="number"
            max={100}
            min={0}
            className={inputClass}
            value={d.spo2O2}
            onChange={(e) =>
              onPatch({ spo2O2: Math.min(100, Math.max(0, Number(e.target.value))) })
            }
          />
        </FormField>
        <FormField label="FC">
          <input
            type="number"
            className={inputClass}
            value={d.fc}
            onChange={(e) => onPatch({ fc: Number(e.target.value) })}
          />
        </FormField>
        <FormField label="PA sist">
          <input
            type="number"
            className={inputClass}
            value={d.paSis}
            onChange={(e) => onPatch({ paSis: Number(e.target.value) })}
          />
        </FormField>
        <FormField label="PA dia">
          <input
            type="number"
            className={inputClass}
            value={d.paDia}
            onChange={(e) => onPatch({ paDia: Number(e.target.value) })}
          />
        </FormField>
      </div>

      <FormField label="APP">
        <textarea
          className={inputClass}
          rows={2}
          value={d.app ?? ''}
          onChange={(e) => onPatch({ app: e.target.value })}
        />
      </FormField>

      <FormField label="Descrizione">
        <textarea
          className={inputClass}
          rows={3}
          value={d.descrizione ?? ''}
          onChange={(e) => onPatch({ descrizione: e.target.value })}
        />
      </FormField>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase text-slate-600">Codice colore</p>
        <div className="flex flex-wrap gap-2">
          {DEFAULT_IMPOSTAZIONI.coloriEvento.map((c) => {
            const sel = d.codiceColore === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => onPatch({ codiceColore: c })}
                className={`flex flex-col items-center gap-1 rounded-lg border-2 px-2 py-1.5 ${
                  sel ? 'border-sky-600 bg-sky-50 ring-2 ring-sky-300' : 'border-slate-200 bg-white'
                }`}
              >
                <ColoreIndicator colore={c} size="md" />
                <span className="text-[9px] font-bold uppercase">{c}</span>
              </button>
            );
          })}
        </div>
      </div>

      <FormField label="Esito">
        <select
          className={selectClass}
          value={d.esitoMsb}
          onChange={(e) => {
            const esitoMsb = e.target.value;
            const next = { esitoMsb };
            if (esitoMsb !== 'Trasportato') {
              next.mezzoMsb = '';
              next.ospedaleDestinazioneMsb = '';
            }
            if (esitoMsb !== 'Altro') next.esitoAltroMsb = '';
            onPatch(next);
          }}
        >
          {ESITI_MSB.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
      </FormField>

      {altro && (
        <FormField label="Specificare">
          <textarea
            className={inputClass}
            rows={2}
            value={d.esitoAltroMsb ?? ''}
            onChange={(e) => onPatch({ esitoAltroMsb: e.target.value })}
          />
        </FormField>
      )}

      {transportato && (
        <>
          <FormField label="Mezzo">
            <select
              className={selectClass}
              title="Può coincidere con il mezzo del trasporto; più pazienti possono condividere lo stesso mezzo."
              value={d.mezzoMsb ?? ''}
              onChange={(e) => onPatch({ mezzoMsb: e.target.value })}
            >
              <option value="">—</option>
              {(mezziEventoSigle ?? []).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="H destinazione">
            <select
              className={selectClass}
              value={d.ospedaleDestinazioneMsb ?? ''}
              onChange={(e) => onPatch({ ospedaleDestinazioneMsb: e.target.value })}
            >
              <option value="">—</option>
              {(ospedali ?? []).map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </FormField>
        </>
      )}
    </div>
  );
}
