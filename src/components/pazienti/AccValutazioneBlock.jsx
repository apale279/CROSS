import { Timestamp } from 'firebase/firestore';
import { fromDatetimeLocalValue, toDatetimeLocalValue } from '../../lib/datetimeLocal';
import {
  computeLowFlowMinutes,
  computeNoFlowMinutes,
  emptyMsaAcc,
  formatFlowMinutes,
  isMsaAccAttivo,
  normalizeMsaAcc,
  RITMO_PRESENTAZIONE_OPTS,
} from '../../lib/msaValutazione';
import { FormField, inputClass, selectClass } from '../ui/FormField';

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

/**
 * Blocco ACC (arresto cardiocircolatorio) condiviso tra valutazione MSB e MSA.
 * @param {{ acc?: object, onPatchAcc: (partial: object) => void }} props
 */
export function AccValutazioneBlock({ acc: accRaw, onPatchAcc }) {
  const acc = normalizeMsaAcc(accRaw);
  const accAttivo = isMsaAccAttivo(acc);

  const patchAcc = (partial) => {
    onPatchAcc({ ...acc, attivo: accAttivo, ...partial });
  };

  const setAccAttivo = (on) => {
    if (on) {
      const base = emptyMsaAcc();
      onPatchAcc({
        ...base,
        ...acc,
        attivo: true,
        dataOraAcc: acc.dataOraAcc ?? Timestamp.now(),
      });
      return;
    }
    onPatchAcc({ ...acc, attivo: false });
  };

  const noFlow = computeNoFlowMinutes(acc);
  const lowFlow = computeLowFlowMinutes(acc);

  return (
    <div className="flex w-full flex-col items-center">
      <div className="flex flex-col items-center gap-1.5">
        <button
          type="button"
          className={
            accAttivo
              ? 'rounded-lg bg-red-600 px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-white shadow-md ring-2 ring-red-400 ring-offset-1'
              : 'rounded-lg border-2 border-red-600 bg-white px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-red-700 shadow-sm hover:bg-red-50'
          }
          aria-pressed={accAttivo}
          title={
            accAttivo
              ? 'ACC attivo — clic per disattivare'
              : 'Attiva arresto cardiocircolatorio (ACC)'
          }
          onClick={() => setAccAttivo(!accAttivo)}
        >
          ACC
        </button>
        <p className="max-w-xs text-center text-xs text-slate-600">
          {accAttivo
            ? 'Arresto cardiocircolatorio — campi attivi'
            : 'Arresto cardiocircolatorio non attivo'}
        </p>
      </div>

      {accAttivo ? (
        <div className="mt-3 w-full space-y-3 rounded-lg border-2 border-red-300 bg-red-50/50 p-3">
          <AccDatetimeField
            label="Data e ora ACC"
            tsValue={acc.dataOraAcc}
            onChange={(dataOraAcc) => patchAcc({ dataOraAcc, attivo: true })}
          />

          <SiNoSelect
            label="Testimoniato?"
            value={acc.testimoniato}
            onChange={(testimoniato) => patchAcc({ testimoniato, attivo: true })}
          />

          <SiNoSelect
            label="Bystander RCP?"
            value={acc.bystanderRcp}
            onChange={(bystanderRcp) => {
              const patch = { bystanderRcp, attivo: true };
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
                onChange={(bystanderInizio) => patchAcc({ bystanderInizio, attivo: true })}
              />
              <SiNoSelect
                label="Efficace?"
                value={acc.bystanderEfficace}
                onChange={(bystanderEfficace) => patchAcc({ bystanderEfficace, attivo: true })}
              />
            </div>
          )}

          <FormField label="Ritmo presentazione">
            <select
              className={selectClass}
              value={acc.ritmoPresentazione}
              onChange={(e) => patchAcc({ ritmoPresentazione: e.target.value, attivo: true })}
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
              onChange={(inizioBlsd) => patchAcc({ inizioBlsd, attivo: true })}
            />
            <AccDatetimeField
              label="Inizio ACLS"
              tsValue={acc.inizioAcls}
              onChange={(inizioAcls) => patchAcc({ inizioAcls, attivo: true })}
            />
          </div>

          <FormField label="N° shock">
            <input
              type="number"
              min={0}
              max={99}
              className={inputClass}
              value={acc.numeroShock}
              onChange={(e) => patchAcc({ numeroShock: Number(e.target.value), attivo: true })}
            />
          </FormField>

          <AccDatetimeField
            label="Data e ora ROSC"
            tsValue={acc.dataOraRosc}
            onChange={(dataOraRosc) => patchAcc({ dataOraRosc, attivo: true })}
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
            onChange={(percorsoEcmo) => patchAcc({ percorsoEcmo, attivo: true })}
          />
        </div>
      ) : null}
    </div>
  );
}
