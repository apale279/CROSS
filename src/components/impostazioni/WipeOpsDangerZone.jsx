import { useState } from 'react';
import { useManifestationIdOptional } from '../../context/ManifestazioneContext';
import { exportOpsDataCsv } from '../../services/opsDataExportService';
import { wipeAllOpsData } from '../../services/wipeOpsDataService';
import { btnSecondary } from '../ui/FormField';

export function WipeOpsDangerZone() {
  const manifestationId = useManifestationIdOptional();
  const [exportBusy, setExportBusy] = useState(false);
  const [wipeBusy, setWipeBusy] = useState(false);
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
    if (
      !window.confirm(
        'Eliminare TUTTI i pazienti (inclusi PMA, valutazioni e cartella clinica), tutte le missioni, tutti gli eventi e tutti i mezzi di questa manifestazione? Operazione irreversibile.',
      )
    ) {
      return;
    }
    if (
      !window.confirm(
        'Conferma definitiva: il database operativo verrà azzerato. Consigliato esportare prima con «Esporta».',
      )
    ) {
      return;
    }
    setWipeBusy(true);
    try {
      await wipeAllOpsData(manifestationId);
      setFeedback('Database operativo azzerato: pazienti, missioni, eventi e mezzi eliminati.');
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      setWipeBusy(false);
    }
  };

  const busy = exportBusy || wipeBusy;

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
          Azzera il database operativo della manifestazione: elimina tutti i pazienti (con
          sotto-collezioni e dati PMA/cartella clinica), tutte le missioni, tutti gli eventi e tutti
          i mezzi. Non modifica impostazioni, utenti Telegram o note diario.
        </p>
        {feedback && (
          <p className="mt-2 rounded border border-emerald-300 bg-white px-2 py-1 text-sm text-emerald-900">
            {feedback}
          </p>
        )}
        {error && (
          <p className="mt-2 rounded border border-red-300 bg-white px-2 py-1 font-mono text-xs text-red-800">
            {error}
          </p>
        )}
        <button
          type="button"
          disabled={busy || !manifestationId}
          onClick={onWipe}
          className="mt-3 rounded-lg border border-red-700 bg-white px-3 py-2 text-sm font-bold text-red-800 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {wipeBusy
            ? 'Eliminazione in corso…'
            : 'Elimina tutti pazienti, eventi, missioni e mezzi'}
        </button>
      </section>
    </div>
  );
}
