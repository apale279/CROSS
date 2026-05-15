import { useState } from 'react';
import { useManifestationIdOptional } from '../../context/ManifestazioneContext';
import { wipeAllEventiMissioniMezzi } from '../../services/wipeOpsDataService';

export function WipeOpsDangerZone() {
  const manifestationId = useManifestationIdOptional();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const onWipe = async () => {
    setError(null);
    if (!manifestationId) {
      setError('Tenant non disponibile.');
      return;
    }
    if (
      !window.confirm(
        'Eliminare TUTTI gli eventi, tutte le missioni (anche orfane) e tutti i mezzi di questa manifestazione? L’operazione non è annullabile.',
      )
    ) {
      return;
    }
    if (
      !window.confirm(
        'Conferma definitiva: verranno cancellati da Firestore eventi, missioni e mezzi.',
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await wipeAllEventiMissioniMezzi(manifestationId);
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-lg border border-red-200 bg-red-50/80 p-4">
      <h3 className="text-sm font-bold uppercase text-red-900">Zona pericolosa</h3>
      <p className="mt-2 text-sm text-red-900/90">
        Svuota completamente eventi, missioni e mezzi della manifestazione corrente (i pazienti
        collegati agli eventi vengono rimossi come nella cancellazione singola di un evento).
      </p>
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
        {busy ? 'Eliminazione in corso…' : 'Elimina tutti eventi, missioni e mezzi'}
      </button>
    </section>
  );
}
