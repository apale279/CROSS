import { useEffect, useState } from 'react';
import { useImpostazioniField } from '../../hooks/useImpostazioniField';
import { geocodeAddress, loadGoogleMaps } from '../../lib/googleMaps';

export function MappaDashboardCentroEditor() {
  const { value, saveField, saving, loading } = useImpostazioniField('mappaDashboardDefault');
  const [draftLuogo, setDraftLuogo] = useState('');
  const [zoomDraft, setZoomDraft] = useState('14');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [savedOk, setSavedOk] = useState(false);

  useEffect(() => {
    if (loading) return;
    setDraftLuogo(value?.luogo ?? '');
    setZoomDraft(String(value?.zoom ?? 14));
  }, [loading, value]);

  const handleApply = async () => {
    const q = draftLuogo.trim();
    setError(null);
    setSavedOk(false);
    if (!q) {
      setError('Scrivi un luogo (indirizzo, località o punto di riferimento).');
      return;
    }
    const zoomNum = Number.parseInt(zoomDraft, 10);
    const zoom =
      Number.isFinite(zoomNum) ? Math.min(20, Math.max(2, zoomNum)) : 14;

    setBusy(true);
    try {
      let maps;
      try {
        maps = await loadGoogleMaps();
      } catch (e) {
        throw new Error(
          e?.message ??
            'Google Maps non disponibile: verifica VITE_GOOGLE_MAPS_API_KEY e Geocoding API nel progetto Cloud.',
        );
      }
      const geo = await geocodeAddress(maps, q);
      if (!geo) {
        throw new Error('Luogo non trovato. Prova un indirizzo più specifico.');
      }
      await saveField({
        luogo: geo.indirizzo ?? q,
        lat: geo.coordinate.lat,
        lng: geo.coordinate.lng,
        zoom,
      });
      setDraftLuogo(geo.indirizzo ?? q);
      setSavedOk(true);
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleClear = async () => {
    setError(null);
    setSavedOk(false);
    try {
      await saveField(null);
      setDraftLuogo('');
      setZoomDraft('14');
    } catch (e) {
      setError(e?.message ?? String(e));
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-bold uppercase text-slate-800">Centro mappa dashboard</h3>
      <p className="mt-1 text-sm text-slate-600">
        Quando nessun evento ha coordinate, la mappa sulla dashboard si centra qui. Puoi digitare un indirizzo, una
        via o una località (Geocoding Google).
      </p>

      {!loading && value?.lat != null && value?.lng != null && (
        <p className="mt-2 rounded-lg bg-slate-50 px-2 py-1.5 font-mono text-xs text-slate-700">
          Salvato: {Number(value.lat).toFixed(5)}, {Number(value.lng).toFixed(5)}
          {value.luogo ? ` · ${value.luogo}` : ''}
        </p>
      )}

      <div className="mt-3 grid gap-3">
        <div>
          <label htmlFor="map-center-place" className="mb-1 block text-xs font-bold uppercase text-slate-600">
            Luogo da centrare
          </label>
          <input
            id="map-center-place"
            type="text"
            value={draftLuogo}
            onChange={(ev) => setDraftLuogo(ev.target.value)}
            placeholder="Es. Piazza del Duomo, Milano"
            disabled={busy || saving}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-sky-500 focus:ring-2 disabled:bg-slate-50"
          />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[100px]">
            <label htmlFor="map-center-zoom" className="mb-1 block text-xs font-bold uppercase text-slate-600">
              Zoom
            </label>
            <input
              id="map-center-zoom"
              type="number"
              min={2}
              max={20}
              value={zoomDraft}
              onChange={(ev) => setZoomDraft(ev.target.value)}
              disabled={busy || saving}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm outline-none ring-sky-500 focus:ring-2 disabled:bg-slate-50"
            />
          </div>
          <button
            type="button"
            disabled={busy || saving || loading}
            onClick={() => void handleApply()}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-bold uppercase text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {busy ? 'Ricerca…' : 'Cerca e salva centro'}
          </button>
          <button
            type="button"
            disabled={busy || saving || loading}
            onClick={() => void handleClear()}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold uppercase text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Ripristina default Roma
          </button>
          {(loading || saving) && (
            <span className="self-center text-xs text-slate-500">
              {loading ? 'Carico impostazioni…' : 'Salvo…'}
            </span>
          )}
        </div>
      </div>

      {savedOk && <p className="mt-2 text-xs font-semibold text-emerald-700">Centro salvato.</p>}
      {error && (
        <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      )}
    </section>
  );
}
