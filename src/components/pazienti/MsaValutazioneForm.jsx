import { useEffect, useRef, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { DEFAULT_IMPOSTAZIONI } from '../../constants';
import { fromDatetimeLocalValue, toDatetimeLocalValue } from '../../lib/datetimeLocal';
import {
  computeLowFlowMinutes,
  computeNoFlowMinutes,
  formatFlowMinutes,
  normalizeMsaAcc,
  normalizeMsaDetails,
  RITMO_PRESENTAZIONE_OPTS,
} from '../../lib/msaValutazione';
import { ColoreIndicator } from '../ui/ColoreIndicator';
import { FormField, btnSecondary, inputClass, selectClass } from '../ui/FormField';
import { ValutazioneMezzoButtons } from './ValutazioneMezzoButtons';
import { MsaParametriVitaliFields } from './MsaParametriVitaliFields';

function SiNoSelect({ value, onChange, label }) {
  return (
    <FormField label={label}>
      <select className={selectClass} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="NO">NO</option>
        <option value="SI">SI</option>
      </select>
    </FormField>
  );
}

function AccDatetimeField({ label, tsValue, onChange }) {
  return (
    <FormField label={label}>
      <input
        type="datetime-local"
        className={inputClass}
        value={toDatetimeLocalValue(tsValue)}
        onChange={(e) => {
          const d = fromDatetimeLocalValue(e.target.value);
          onChange(d ? Timestamp.fromDate(d) : null);
        }}
      />
    </FormField>
  );
}

export function MsaValutazioneForm({
  msaDetails,
  creatoIl,
  mezziEventoSigle,
  onPatchDetails,
  onPatchCreatoIl,
  valuationId,
}) {
  const d = normalizeMsaDetails(msaDetails);
  const acc = normalizeMsaAcc(d.acc);
  const [accOpen, setAccOpen] = useState(false);
  const persistedRef = useRef(false);

  useEffect(() => {
    persistedRef.current = false;
  }, [valuationId]);

  useEffect(() => {
    if (!valuationId || persistedRef.current) return;
    persistedRef.current = true;
    onPatchDetails(normalizeMsaDetails(msaDetails));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valuationId]);

  const patchAcc = (partial) => {
    onPatchDetails({ acc: { ...acc, ...partial } });
  };

  const openAcc = () => {
    if (!accOpen && !acc.dataOraAcc) {
      patchAcc({ dataOraAcc: Timestamp.now() });
    }
    setAccOpen(true);
  };

  const toggleAcc = () => {
    if (accOpen) setAccOpen(false);
    else openAcc();
  };

  const noFlow = computeNoFlowMinutes(acc);
  const lowFlow = computeLowFlowMinutes(acc);

  const patchFarmaci = (next) => onPatchDetails({ farmaci: next });

  return (
    <div className="space-y-3 border-l-2 border-violet-400 pl-3">
      <ValutazioneMezzoButtons
        mezziSigle={mezziEventoSigle}
        value={d.mezzoMsa ?? ''}
        onChange={(mezzoMsa) => onPatchDetails({ mezzoMsa })}
      />

      <FormField label="Data e ora valutazione">
        <input
          type="datetime-local"
          className={inputClass}
          value={toDatetimeLocalValue(creatoIl ?? Timestamp.now())}
          onChange={(e) => {
            const date = fromDatetimeLocalValue(e.target.value);
            if (date) onPatchCreatoIl(Timestamp.fromDate(date));
          }}
        />
      </FormField>

      <div className="overflow-hidden rounded-lg border-2 border-red-400 bg-red-50/60">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left font-bold uppercase tracking-wide text-red-900"
          onClick={toggleAcc}
          aria-expanded={accOpen}
        >
          <span className="flex items-center gap-2">
            {accOpen ? (
              <ChevronDown className="h-4 w-4 shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0" />
            )}
            ACC — Arresto cardiocircolatorio
          </span>
        </button>

        {accOpen && (
          <div className="space-y-3 border-t border-red-300 px-3 pb-3 pt-2">
            <AccDatetimeField
              label="Data e ora ACC"
              tsValue={acc.dataOraAcc}
              onChange={(dataOraAcc) => patchAcc({ dataOraAcc })}
            />

            <SiNoSelect
              label="Testimoniato?"
              value={acc.testimoniato}
              onChange={(testimoniato) => patchAcc({ testimoniato })}
            />

            <SiNoSelect
              label="Bystander RCP?"
              value={acc.bystanderRcp}
              onChange={(bystanderRcp) => {
                const patch = { bystanderRcp };
                if (bystanderRcp === 'SI' && !acc.bystanderInizio) {
                  patch.bystanderInizio = Timestamp.now();
                }
                if (bystanderRcp === 'NO') {
                  patch.bystanderInizio = null;
                  patch.bystanderEfficace = 'NO';
                }
                patchAcc(patch);
              }}
            />

            {acc.bystanderRcp === 'SI' && (
              <div className="grid gap-3 rounded border border-red-200 bg-white/80 p-3 sm:grid-cols-2">
                <AccDatetimeField
                  label="Data e ora inizio BCPR"
                  tsValue={acc.bystanderInizio}
                  onChange={(bystanderInizio) => patchAcc({ bystanderInizio })}
                />
                <SiNoSelect
                  label="Efficace?"
                  value={acc.bystanderEfficace}
                  onChange={(bystanderEfficace) => patchAcc({ bystanderEfficace })}
                />
              </div>
            )}

            <FormField label="Ritmo presentazione">
              <select
                className={selectClass}
                value={acc.ritmoPresentazione}
                onChange={(e) => patchAcc({ ritmoPresentazione: e.target.value })}
              >
                <option value="">—</option>
                {RITMO_PRESENTAZIONE_OPTS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </FormField>

            <div className="grid gap-3 sm:grid-cols-2">
              <AccDatetimeField
                label="Inizio BLSD"
                tsValue={acc.inizioBlsd}
                onChange={(inizioBlsd) => patchAcc({ inizioBlsd })}
              />
              <AccDatetimeField
                label="Inizio ACLS"
                tsValue={acc.inizioAcls}
                onChange={(inizioAcls) => patchAcc({ inizioAcls })}
              />
            </div>

            <FormField label="N° shock">
              <input
                type="number"
                min={0}
                max={99}
                className={inputClass}
                value={acc.numeroShock}
                onChange={(e) => patchAcc({ numeroShock: Number(e.target.value) })}
              />
            </FormField>

            <AccDatetimeField
              label="Data e ora ROSC"
              tsValue={acc.dataOraRosc}
              onChange={(dataOraRosc) => patchAcc({ dataOraRosc })}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="No flow (calcolato)">
                <input
                  type="text"
                  className={`${inputClass} bg-slate-100`}
                  readOnly
                  value={formatFlowMinutes(noFlow)}
                  title="Differenza tra ora ACC e prima manovra (BCPR / BLSD / ACLS)"
                />
              </FormField>
              <FormField label="Low flow (calcolato)">
                <input
                  type="text"
                  className={`${inputClass} bg-slate-100`}
                  readOnly
                  value={formatFlowMinutes(lowFlow)}
                  title="Differenza tra prima manovra e ROSC (vuoto se ROSC assente)"
                />
              </FormField>
            </div>

            <SiNoSelect
              label="Percorso ECMO?"
              value={acc.percorsoEcmo}
              onChange={(percorsoEcmo) => patchAcc({ percorsoEcmo })}
            />
          </div>
        )}
      </div>

      <MsaParametriVitaliFields
        parametri={d.parametri}
        onPatch={(partial) =>
          onPatchDetails({
            parametri: { ...normalizeMsaDetails(d).parametri, ...partial },
          })
        }
      />

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase text-slate-700">Farmaci</p>
          <button
            type="button"
            className={`${btnSecondary} inline-flex items-center gap-1 text-xs`}
            onClick={() => patchFarmaci([...(d.farmaci ?? []), ''])}
          >
            <Plus className="h-3.5 w-3.5" />
            Farmaco
          </button>
        </div>
        <ul className="space-y-2">
          {(d.farmaci ?? []).length === 0 ? (
            <li>
              <button
                type="button"
                className={`${btnSecondary} w-full text-xs`}
                onClick={() => patchFarmaci([''])}
              >
                + Aggiungi farmaco
              </button>
            </li>
          ) : (
            (d.farmaci ?? []).map((farmaco, idx) => (
              <li key={idx} className="flex gap-2">
                <input
                  type="text"
                  className={inputClass}
                  placeholder="Nome / dose / via…"
                  value={farmaco}
                  onChange={(e) => {
                    const next = [...d.farmaci];
                    next[idx] = e.target.value;
                    patchFarmaci(next);
                  }}
                />
                <button
                  type="button"
                  className="shrink-0 rounded p-2 text-slate-400 hover:bg-red-100 hover:text-red-700"
                  title="Rimuovi"
                  onClick={() => patchFarmaci(d.farmaci.filter((_, i) => i !== idx))}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))
          )}
        </ul>
      </div>

      <FormField label="Note MSA">
        <textarea
          className={inputClass}
          rows={5}
          value={d.noteMsa ?? ''}
          onChange={(e) => onPatchDetails({ noteMsa: e.target.value })}
        />
      </FormField>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase text-slate-600">
          Codice colore trasporto
        </p>
        <p className="mb-2 text-[10px] text-slate-500">
          Imposta il codice T della missione quando il paziente è in trasporto.
        </p>
        <div className="flex flex-wrap gap-2">
          {DEFAULT_IMPOSTAZIONI.coloriEvento.map((c) => {
            const sel = d.codiceColore != null && d.codiceColore === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => onPatchDetails({ codiceColore: c })}
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
              onClick={() => onPatchDetails({ codiceColore: null })}
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
