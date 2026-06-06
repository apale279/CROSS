import { DEFAULT_IMPOSTAZIONI } from '../../constants';
import {
  CUTE_OPTIONS,
  MR_OPTIONS,
  normalizeMsbDetails,
  toggleCute,
  toggleMeccanica,
} from '../../lib/msbValutazione';
import { parseVitalNumericInput, vitalInputValue } from '../../lib/vitalNumeric';
import { ColoreIndicator } from '../ui/ColoreIndicator';
import { BlurCommitTextarea } from '../ui/BlurCommitTextarea';
import { FormField, inputClass, selectClass } from '../ui/FormField';
import { AccValutazioneBlock } from './AccValutazioneBlock';
import { ValutazioneMezzoButtons } from './ValutazioneMezzoButtons';
import { ValutazioneLesioniTable } from './ValutazioneLesioniTable';
import { ValutazioneImpostazioniMultiselect } from './ValutazioneImpostazioniMultiselect';
import { useImpostazioni } from '../../hooks/useImpostazioni';
import {
  listaMsbMsaPresidi,
  listaPrestazioniMsb,
  intersectSelectionWithCatalog,
} from '../../lib/valutazioneMsbMsaLists';

function patchVital(onPatch, key, raw, opts) {
  const parsed = parseVitalNumericInput(raw, opts);
  if (parsed === undefined) return;
  onPatch({ [key]: parsed });
}

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

export function MsbValutazioneForm({ msbDetails, onPatch, mezziEventoSigle }) {
  const { impostazioni } = useImpostazioni();
  const catalogPresidi = listaMsbMsaPresidi(impostazioni);
  const catalogPrestazioniMsb = listaPrestazioniMsb(impostazioni);
  const d = normalizeMsbDetails(msbDetails);

  return (
    <div className="space-y-3 border-l-2 border-teal-300 pl-3">
      <ValutazioneMezzoButtons
        mezziSigle={mezziEventoSigle}
        value={d.mezzoMsb ?? ''}
        onChange={(mezzoMsb) => onPatch({ mezzoMsb })}
      />

      <AccValutazioneBlock acc={d.acc} onPatchAcc={(accPartial) => onPatch({ acc: accPartial })} />

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
            className={inputClass}
            value={vitalInputValue(d.fc)}
            placeholder="—"
            onChange={(e) => patchVital(onPatch, 'fc', e.target.value, { min: 0, integer: true })}
          />
        </FormField>
        <FormField label="PA sist">
          <input
            type="number"
            className={inputClass}
            value={vitalInputValue(d.paSis)}
            placeholder="—"
            onChange={(e) => patchVital(onPatch, 'paSis', e.target.value, { min: 0, integer: true })}
          />
        </FormField>
        <FormField label="PA dia">
          <input
            type="number"
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

      <ValutazioneLesioniTable
        lesioni={d.lesioni}
        onPatchLesioni={(next) => onPatch({ lesioni: next })}
      />

      <ValutazioneImpostazioniMultiselect
        label="Presidi"
        options={catalogPresidi}
        selected={d.presidi}
        onChange={(next) =>
          onPatch({
            presidi: intersectSelectionWithCatalog(catalogPresidi, next),
          })
        }
      />

      <ValutazioneImpostazioniMultiselect
        label="Prestazioni MSB"
        options={catalogPrestazioniMsb}
        selected={d.prestazioniMsb}
        onChange={(next) =>
          onPatch({
            prestazioniMsb: intersectSelectionWithCatalog(catalogPrestazioniMsb, next),
          })
        }
      />

      <FormField label="APP">
        <BlurCommitTextarea
          className={inputClass}
          rows={2}
          value={d.app ?? ''}
          onCommit={(app) => onPatch({ app })}
        />
      </FormField>

      <FormField label="Descrizione">
        <BlurCommitTextarea
          className={inputClass}
          rows={3}
          value={d.descrizione ?? ''}
          onCommit={(descrizione) => onPatch({ descrizione })}
        />
      </FormField>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase text-slate-600">
          Codice colore trasporto
        </p>
        <p className="mb-2 text-[10px] text-slate-500">
          Solo documentazione in questa valutazione. Non modifica il codice paziente (P) né il
          trasporto missione (T): usare «Codice colore paziente» in Esito e trasporto.
        </p>
        <div className="flex flex-wrap gap-2">
          {DEFAULT_IMPOSTAZIONI.coloriEvento.map((c) => {
            const sel = d.codiceColore != null && d.codiceColore === c;
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
          {d.codiceColore != null && (
            <button
              type="button"
              onClick={() => onPatch({ codiceColore: null })}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-50"
            >
              Rimuovi
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
