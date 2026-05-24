import { useEffect, useRef } from 'react';
import { DEFAULT_IMPOSTAZIONI } from '../../constants';
import {
  CUTE_OPTIONS,
  MR_OPTIONS,
  normalizeMsbDetails,
  toggleCute,
  toggleMeccanica,
} from '../../lib/msbValutazione';
import { ColoreIndicator } from '../ui/ColoreIndicator';
import { FormField, inputClass, selectClass } from '../ui/FormField';
import { ValutazioneMezzoButtons } from './ValutazioneMezzoButtons';

const avpuOpts = ['A', 'V', 'P', 'U'];

const chipBtn = (active) =>
  `rounded-md border px-2 py-1 text-xs font-semibold uppercase ${
    active
      ? 'border-teal-600 bg-teal-100 text-teal-900'
      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
  }`;

function isMeccanicaActive(d, opt) {
  const mr = d.meccanicaRespiratoria ?? [];
  if (opt.absent) return mr.includes('ASSENTE');
  if (!opt.path) return mr.includes('Eupnoico') && !mr.includes('ASSENTE');
  return mr.includes(opt.key);
}

export function MsbValutazioneForm({ msbDetails, onPatch, mezziEventoSigle, valuationId }) {
  const d = normalizeMsbDetails(msbDetails);
  const persistedRef = useRef(false);

  useEffect(() => {
    persistedRef.current = false;
  }, [valuationId]);

  /** Persiste i default precompilati senza attendere un cambio campo. */
  useEffect(() => {
    if (!valuationId || persistedRef.current) return;
    persistedRef.current = true;
    onPatch(normalizeMsbDetails(msbDetails));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- snapshot una tantum per valutazione
  }, [valuationId]);

  return (
    <div className="space-y-3 border-l-2 border-teal-300 pl-3">
      <ValutazioneMezzoButtons
        mezziSigle={mezziEventoSigle}
        value={d.mezzoMsb ?? ''}
        onChange={(mezzoMsb) => onPatch({ mezzoMsb })}
      />

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
        <p className="mt-1 text-[10px] text-slate-500">
          ASSENTE ed Eupnoico sono esclusivi con le condizioni patologiche.
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
              onPatch({
                glicemia: raw === '' ? null : Number(raw),
              });
            }}
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
    </div>
  );
}
