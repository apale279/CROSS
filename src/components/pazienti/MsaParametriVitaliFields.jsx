import {
  CUTE_OPTIONS,
  MR_OPTIONS,
  toggleCute,
  toggleMeccanica,
} from '../../lib/msbValutazione';
import { normalizeMsaParametri } from '../../lib/msaValutazione';
import { parseVitalNumericInput, vitalInputValue } from '../../lib/vitalNumeric';
import { FormField, inputClass } from '../ui/FormField';

const chipBtn = (active) =>
  `rounded-md border px-2 py-1 text-xs font-semibold uppercase ${
    active
      ? 'border-violet-600 bg-violet-100 text-violet-900'
      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
  }`;

function isMeccanicaActive(d, opt) {
  const mr = d.meccanicaRespiratoria ?? [];
  if (opt.absent) return mr.includes('ASSENTE');
  if (!opt.path) return mr.includes('Eupnoico') && !mr.includes('ASSENTE');
  return mr.includes(opt.key);
}

function patchVital(onPatch, key, raw, opts) {
  const parsed = parseVitalNumericInput(raw, opts);
  if (parsed === undefined) return;
  onPatch({ [key]: parsed });
}

/** Parametri vitali MSA (duplicato MSB senza AVPU). */
export function MsaParametriVitaliFields({ parametri, onPatch }) {
  const d = normalizeMsaParametri(parametri);

  return (
    <div className="space-y-3 rounded border border-violet-200 bg-violet-50/40 p-3">
      <p className="text-xs font-bold uppercase text-violet-900">Parametri vitali</p>

      <FormField label="GCS (3–15)">
        <input
          type="number"
          min={3}
          max={15}
          className={inputClass}
          value={vitalInputValue(d.gcs)}
          placeholder="—"
          onChange={(e) => patchVital(onPatch, 'gcs', e.target.value, { min: 3, max: 15, integer: true })}
        />
      </FormField>

      <FormField label="FR">
        <input
          type="number"
          min={0}
          className={inputClass}
          value={vitalInputValue(d.fr)}
          placeholder="—"
          onChange={(e) => patchVital(onPatch, 'fr', e.target.value, { min: 0, integer: true })}
        />
      </FormField>

      <div>
        <p className="mb-1 text-xs font-medium text-slate-600">Meccanica respiratoria</p>
        <div className="flex flex-wrap gap-2">
          {MR_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              className={chipBtn(isMeccanicaActive(d, opt))}
              onClick={() =>
                onPatch({
                  meccanicaRespiratoria: toggleMeccanica(d.meccanicaRespiratoria ?? [], opt.key),
                })
              }
            >
              {opt.key}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="SpO2 AA (< 101)">
          <input
            type="number"
            max={100}
            min={0}
            className={inputClass}
            value={vitalInputValue(d.spo2Aa)}
            placeholder="—"
            onChange={(e) =>
              patchVital(onPatch, 'spo2Aa', e.target.value, { min: 0, max: 100, integer: true })
            }
          />
        </FormField>
        <FormField label="SpO2 O2 (< 101)">
          <input
            type="number"
            max={100}
            min={0}
            className={inputClass}
            value={vitalInputValue(d.spo2O2)}
            placeholder="—"
            onChange={(e) =>
              patchVital(onPatch, 'spo2O2', e.target.value, { min: 0, max: 100, integer: true })
            }
          />
        </FormField>
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-slate-600">CUTE</p>
        <div className="flex flex-wrap gap-2">
          {CUTE_OPTIONS.map((key) => {
            const active = (d.cute ?? []).includes(key);
            return (
              <button
                key={key}
                type="button"
                className={chipBtn(active)}
                onClick={() => onPatch({ cute: toggleCute(d.cute ?? [], key) })}
              >
                {key}
              </button>
            );
          })}
        </div>
        <p className="mt-1 text-[10px] text-slate-500">Selezione multipla.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="FC">
          <input
            type="number"
            min={0}
            className={inputClass}
            value={vitalInputValue(d.fc)}
            placeholder="—"
            onChange={(e) => patchVital(onPatch, 'fc', e.target.value, { min: 0, integer: true })}
          />
        </FormField>
        <FormField label="PA sist">
          <input
            type="number"
            min={0}
            className={inputClass}
            value={vitalInputValue(d.paSis)}
            placeholder="—"
            onChange={(e) => patchVital(onPatch, 'paSis', e.target.value, { min: 0, integer: true })}
          />
        </FormField>
        <FormField label="PA dia">
          <input
            type="number"
            min={0}
            className={inputClass}
            value={vitalInputValue(d.paDia)}
            placeholder="—"
            onChange={(e) => patchVital(onPatch, 'paDia', e.target.value, { min: 0, integer: true })}
          />
        </FormField>
        <FormField label="Temperatura (°C)">
          <input
            type="number"
            step="0.1"
            min={30}
            max={45}
            className={inputClass}
            value={vitalInputValue(d.temperatura)}
            placeholder="—"
            onChange={(e) => patchVital(onPatch, 'temperatura', e.target.value, { min: 30, max: 45 })}
          />
        </FormField>
        <FormField label="Glicemia (mg/dL)">
          <input
            type="number"
            min={0}
            max={800}
            className={inputClass}
            value={vitalInputValue(d.glicemia)}
            placeholder="—"
            onChange={(e) =>
              patchVital(onPatch, 'glicemia', e.target.value, { min: 0, max: 800, integer: true })
            }
          />
        </FormField>
      </div>
    </div>
  );
}
