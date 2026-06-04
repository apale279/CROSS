import { useState } from 'react';
import { useManifestationIdOptional } from '../../context/ManifestazioneContext';
import {
  COUNTER_RESET_KEYS,
  COUNTER_RESET_LABELS,
  emptyCounterSelection,
  emptyEntitySelection,
  selectedCounterKeys,
  selectedEntityKeys,
  WIPE_ENTITY_KEYS,
  WIPE_ENTITY_LABELS,
} from '../../lib/opsDangerZone';
import { exportOpsDataCsv } from '../../services/opsDataExportService';
import {
  resetSelectedOpsCounters,
  wipeSelectedOpsData,
} from '../../services/wipeOpsDataService';
import { btnSecondary } from '../ui/FormField';

function EntityCheckboxGroup({ selection, onToggle, disabled }) {
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
      {WIPE_ENTITY_KEYS.map((key) => (
        <label
          key={key}
          className="inline-flex cursor-pointer items-center gap-2 text-sm text-red-900"
        >
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-red-400 text-red-700 focus:ring-red-500"
            checked={!!selection[key]}
            disabled={disabled}
            onChange={(e) => onToggle(key, e.target.checked)}
          />
          <span className="font-medium">{WIPE_ENTITY_LABELS[key]}</span>
        </label>
      ))}
    </div>
  );
}

function CounterCheckboxGroup({ selection, onToggle, disabled }) {
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
      {COUNTER_RESET_KEYS.map((key) => (
        <label
          key={key}
          className="inline-flex cursor-pointer items-center gap-2 text-sm text-red-900"
        >
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-red-400 text-red-700 focus:ring-red-500"
            checked={!!selection[key]}
            disabled={disabled}
            onChange={(e) => onToggle(key, e.target.checked)}
          />
          <span className="font-medium">{COUNTER_RESET_LABELS[key]}</span>
        </label>
      ))}
    </div>
  );
}

function labelsForKeys(keys, labelMap) {
  return keys.map((k) => labelMap[k]).join(', ');
}

export function WipeOpsDangerZone() {
  const manifestationId = useManifestationIdOptional();
  const [exportBusy, setExportBusy] = useState(false);
  const [wipeBusy, setWipeBusy] = useState(false);
  const [counterBusy, setCounterBusy] = useState(false);
  const [entitySel, setEntitySel] = useState(emptyEntitySelection);
  const [counterSel, setCounterSel] = useState(emptyCounterSelection);
  const [feedback, setFeedback] = useState(null);
  const [error, setError] = useState(null);

  const onExport = async () => {
    setError(null);
    setFeedback(null);
    if (!manifestationId) {
      setError('Tenant non disponibile.');
      return;
    }
    setExportBusy(true);
    try {
      const counts = await exportOpsDataCsv(manifestationId);
      setFeedback(
        `Esportati ${counts.eventi} eventi, ${counts.missioni} missioni, ${counts.mezzi} mezzi, ${counts.pazienti} pazienti (4 file CSV).`,
      );
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      setExportBusy(false);
    }
  };

  const onWipe = async () => {
    setError(null);
    setFeedback(null);
    if (!manifestationId) {
      setError('Tenant non disponibile.');
      return;
    }
    const keys = selectedEntityKeys(entitySel);
    if (keys.length === 0) {
      setError('Seleziona almeno un\'entità da eliminare.');
      return;
    }
    const labelList = labelsForKeys(keys, WIPE_ENTITY_LABELS);
    if (
      !window.confirm(
        `Eliminare definitivamente: ${labelList}?\n\nOperazione irreversibile per questa manifestazione.`,
      )
    ) {
      return;
    }
    if (
      !window.confirm(
        'Conferma definitiva. Consigliato esportare prima con «Esporta».',
      )
    ) {
      return;
    }
    setWipeBusy(true);
    try {
      const deleted = await wipeSelectedOpsData(manifestationId, entitySel);
      setFeedback(
        `Eliminati: ${labelsForKeys(deleted, WIPE_ENTITY_LABELS)}.`,
      );
      setEntitySel(emptyEntitySelection());
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      setWipeBusy(false);
    }
  };

  const onResetCounters = async () => {
    setError(null);
    setFeedback(null);
    if (!manifestationId) {
      setError('Tenant non disponibile.');
      return;
    }
    const keys = selectedCounterKeys(counterSel);
    if (keys.length === 0) {
      setError('Seleziona almeno un contatore da azzerare.');
      return;
    }
    const labelList = labelsForKeys(keys, COUNTER_RESET_LABELS);
    if (
      !window.confirm(
        `Azzerare i contatori: ${labelList}?\n\nIl prossimo ID progressivo ripartirà da 1 (es. E1, M1, P1). I documenti già presenti non vengono modificati.`,
      )
    ) {
      return;
    }
    if (
      !window.confirm(
        'Conferma: i contatori selezionati verranno impostati a zero in Firestore.',
      )
    ) {
      return;
    }
    setCounterBusy(true);
    try {
      const reset = await resetSelectedOpsCounters(manifestationId, counterSel);
      setFeedback(
        `Contatori azzerati: ${labelsForKeys(reset, COUNTER_RESET_LABELS)}. Prossimi ID progressivi da 1.`,
      );
      setCounterSel(emptyCounterSelection());
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      setCounterBusy(false);
    }
  };

  const busy = exportBusy || wipeBusy || counterBusy;
  const wipeDisabled = busy || !manifestationId || selectedEntityKeys(entitySel).length === 0;
  const counterDisabled =
    busy || !manifestationId || selectedCounterKeys(counterSel).length === 0;

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-slate-300 bg-white p-4">
        <h3 className="text-sm font-bold uppercase text-slate-800">Backup dati operativi</h3>
        <p className="mt-2 text-sm text-slate-600">
          Scarica quattro file CSV con tutti gli eventi, le missioni, i mezzi e i pazienti della
          manifestazione corrente. Per i pazienti sono inclusi{' '}
          <span className="font-medium">pmaScheda</span> (cartella clinica, farmaci, parametri
          vitali, dimissione) e le <span className="font-medium">valutazioni soccorso</span> in
          colonne JSON.
        </p>
        <button
          type="button"
          disabled={busy || !manifestationId}
          onClick={onExport}
          className={`${btnSecondary} mt-3`}
        >
          {exportBusy ? 'Esportazione…' : 'Esporta'}
        </button>
      </section>

      <section className="rounded-lg border border-red-200 bg-red-50/80 p-4">
        <h3 className="text-sm font-bold uppercase text-red-900">Zona pericolosa</h3>
        <p className="mt-2 text-sm text-red-900/90">
          Operazioni irreversibili sulla manifestazione corrente. Non modifica impostazioni né utenti
          Telegram, salvo se selezioni esplicitamente le voci sotto.
        </p>

        <div className="mt-4 rounded border border-red-300/80 bg-white/60 p-3">
          <h4 className="text-xs font-bold uppercase text-red-900">Elimina dati</h4>
          <p className="mt-1 text-sm text-red-900/90">
            Scegli quali collezioni svuotare. I pazienti includono valutazioni soccorso e dati PMA.
          </p>
          <EntityCheckboxGroup
            selection={entitySel}
            disabled={busy}
            onToggle={(key, checked) =>
              setEntitySel((prev) => ({ ...prev, [key]: checked }))
            }
          />
          <button
            type="button"
            disabled={wipeDisabled}
            onClick={onWipe}
            className="mt-3 rounded-lg border border-red-700 bg-white px-3 py-2 text-sm font-bold text-red-800 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {wipeBusy ? 'Eliminazione in corso…' : 'Elimina selezionati'}
          </button>
        </div>

        <div className="mt-4 rounded border border-red-300/80 bg-white/60 p-3">
          <h4 className="text-xs font-bold uppercase text-red-900">Azzera contatori</h4>
          <p className="mt-1 text-sm text-red-900/90">
            Reimposta i contatori ID in Firestore (<code className="text-xs">settings/contatori</code>
            ). Il prossimo ID userà solo il contatore (es. E1), senza riallinearsi agli ID già visibili
            in app. Se in database restano ancora documenti con lo stesso prefisso (E/M/P), puoi avere
            duplicati: elimina prima i dati correlati con «Elimina selezionati».
          </p>
          <CounterCheckboxGroup
            selection={counterSel}
            disabled={busy}
            onToggle={(key, checked) =>
              setCounterSel((prev) => ({ ...prev, [key]: checked }))
            }
          />
          <button
            type="button"
            disabled={counterDisabled}
            onClick={onResetCounters}
            className="mt-3 rounded-lg border border-red-700 bg-red-900 px-3 py-2 text-sm font-bold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {counterBusy ? 'Azzeramento…' : 'Azzera contatori'}
          </button>
        </div>

        {feedback && (
          <p className="mt-3 rounded border border-emerald-300 bg-white px-2 py-1 text-sm text-emerald-900">
            {feedback}
          </p>
        )}
        {error && (
          <p className="mt-2 rounded border border-red-300 bg-white px-2 py-1 font-mono text-xs text-red-800">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
