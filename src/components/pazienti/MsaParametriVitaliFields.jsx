import {
  CUTE_OPTIONS,
  MR_OPTIONS,
  toggleCute,
  toggleMeccanica,
} from '../../lib/msbValutazione';
import { normalizeMsaParametri } from '../../lib/msaValutazione';
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

/** Parametri vitali MSA (duplicato MSB senza AVPU). */
export function MsaParametriVitaliFields({ parametri, onPatch }) {
  const d = normalizeMsaParametri(parametri);

  return (
    <div className="space-y-3 rounded border border-violet-200 bg-violet-50/40 p-3">
      <p className="text-xs font-bold uppercase text-violet-900">Parametri vitali</p>

      <FormField label="GCS (1–15)">
        <input
          type="number"
          min={1}
          max={15}
          className={inputClass}
          value={d.gcs}
          onChange={(e) =>
            onPatch({ gcs: Math.min(15, Math.max(1, Number(e.target.value) || 15)) })
          }
        />
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
        <FormField label="Temperatura (°C)">
          <input
            type="number"
            step="0.1"
            min={30}
            max={45}
            className={inputClass}
            value={d.temperatura}
            onChange={(e) => onPatch({ temperatura: Number(e.target.value) })}
          />
        </FormField>
        <FormField label="Glicemia (mg/dL)">
          <input
            type="number"
            min={0}
            max={800}
            className={inputClass}
            value={d.glicemia ?? ''}
            placeholder="—"
            onChange={(e) => {
              const raw = e.target.value;
              onPatch({ glicemia: raw === '' ? null : Number(raw) });
            }}
          />
        </FormField>
      </div>
    </div>
  );
}
