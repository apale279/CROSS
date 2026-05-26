import { useCallback, useEffect, useRef, useState } from 'react';
import { parseLinesToValues } from '../../pma/lib/multilineList';
import { resolvePmaClinicaFarmaciFields } from '../../pma/lib/pmaClinicaFarmaciFields';
import { useImpostazioniField } from '../../hooks/useImpostazioniField';
import { useManifestationId } from '../../context/ManifestazioneContext';
import { clearPmaClinicaFarmaciConsumati } from '../../services/pmaClinicaImpostazioniService';
import { FarmaciSelezionabiliEditor } from './FarmaciSelezionabiliEditor';
import { FarmaciConsumatiStatsEditor } from './FarmaciConsumatiStatsEditor';
import { btnPrimary, btnSecondary } from '../ui/FormField';
import { SaveFeedback } from './SaveFeedback';

export function PmaClinicaImpostazioniPanel() {
  const manifestationId = useManifestationId();
  const { value: pmaClinica, saveField, saving, loading } = useImpostazioniField('pmaClinica');
  const farmaciDirtyRef = useRef(false);
  const consumatiDirtyRef = useRef(false);
  const [feedback, setFeedback] = useState('');
  const [prestazioniDraft, setPrestazioniDraft] = useState('');
  const [farmaciSelezionabili, setFarmaciSelezionabili] = useState([]);
  const [farmaciConsumati, setFarmaciConsumati] = useState([]);
  const [consensoCure, setConsensoCure] = useState('');
  const [consensoPrivacy, setConsensoPrivacy] = useState('');
  const [rifiutoPs, setRifiutoPs] = useState('');
  const [presetDimissione, setPresetDimissione] = useState([]);

  useEffect(() => {
    if (loading) return;
    const pc = pmaClinica ?? {};
    const { farmaci, farmaci_consumati } = resolvePmaClinicaFarmaciFields(pc);
    setPrestazioniDraft((pc.prestazioni ?? []).join('\n'));
    if (!farmaciDirtyRef.current) setFarmaciSelezionabili(farmaci);
    if (!consumatiDirtyRef.current) setFarmaciConsumati(farmaci_consumati);
    setConsensoCure(pc.consenso_generico_cure ?? '');
    setConsensoPrivacy(pc.consenso_privacy ?? '');
    setRifiutoPs(pc.rifiuto_invio_ps ?? '');
    setPresetDimissione(Array.isArray(pc.preset_dimissione) ? pc.preset_dimissione : []);
  }, [pmaClinica, loading]);

  const persist = useCallback(
    async (next, msg) => {
      setFeedback('');
      try {
        await saveField(next);
        farmaciDirtyRef.current = false;
        consumatiDirtyRef.current = false;
        setFeedback(msg);
      } catch (err) {
        alert(err.message ?? 'Errore salvataggio');
      }
    },
    [saveField],
  );

  const buildBase = () => {
    const {
      dettaglio_eo_rapido: _eo,
      dettaglio_eo_rapido_default: _eoDef,
      ...restPma
    } = pmaClinica ?? {};
    const serverFarmaci = resolvePmaClinicaFarmaciFields(pmaClinica ?? {});
    return {
      ...restPma,
      prestazioni: parseLinesToValues(prestazioniDraft),
      farmaci: farmaciSelezionabili,
      farmaci_consumati: consumatiDirtyRef.current
        ? farmaciConsumati
        : serverFarmaci.farmaci_consumati,
      consenso_generico_cure: consensoCure,
      consenso_privacy: consensoPrivacy,
      rifiuto_invio_ps: rifiutoPs,
      preset_dimissione: presetDimissione,
      preset_farmaci: pmaClinica?.preset_farmaci ?? [],
    };
  };

  if (loading) {
    return <p className="text-sm text-slate-500">Caricamento impostazioni PMA…</p>;
  }

  return (
    <section className="rounded border border-violet-200 bg-white p-4">
      <h3 className="mb-2 text-sm font-bold uppercase text-violet-900">Impostazioni PMA — cartella e dimissioni</h3>
      <p className="mb-4 text-xs text-slate-600">
        Catalogo farmaci per la cartella clinica, statistiche di utilizzo, prestazioni e testi legali PDF.
        L&apos;EO rapido in cartella clinica è definito nel codice (modello strutturato Excel).
      </p>

      <div className="mb-6 space-y-2">
        <h4 className="text-xs font-bold uppercase text-slate-700">Prestazioni (una per riga)</h4>
        <textarea
          className="w-full rounded border border-slate-300 px-3 py-2 font-mono text-sm"
          rows={8}
          value={prestazioniDraft}
          onChange={(e) => setPrestazioniDraft(e.target.value)}
        />
      </div>

      <details className="mb-4 rounded border border-slate-200 bg-slate-50/50 open:bg-white">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-bold uppercase text-slate-800 marker:content-none [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-2">
            <span aria-hidden className="text-slate-500">
              ▾
            </span>
            Farmaci
          </span>
        </summary>
        <div className="border-t border-slate-200 px-4 pb-4 pt-3">
          <FarmaciSelezionabiliEditor
            value={farmaciSelezionabili}
            onChange={(next) => {
              farmaciDirtyRef.current = true;
              setFarmaciSelezionabili(next);
            }}
            disabled={saving}
          />
        </div>
      </details>

      <details className="mb-6 rounded border border-slate-200 bg-slate-50/50 open:bg-white">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-bold uppercase text-slate-800 marker:content-none [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-2">
            <span aria-hidden className="text-slate-500">
              ▾
            </span>
            Farmaci consumati
          </span>
        </summary>
        <div className="border-t border-slate-200 px-4 pb-4 pt-3">
          <FarmaciConsumatiStatsEditor
            value={farmaciConsumati}
            onChange={(next) => {
              consumatiDirtyRef.current = true;
              setFarmaciConsumati(next);
            }}
            disabled={saving}
            onClearRemote={async () => {
              await clearPmaClinicaFarmaciConsumati(manifestationId);
              consumatiDirtyRef.current = false;
            }}
          />
        </div>
      </details>

      <div className="mb-6 space-y-3">
        <h4 className="text-xs font-bold uppercase text-slate-700">Preset dimissioni</h4>
        {presetDimissione.map((row, idx) => (
          <div key={idx} className="rounded border border-slate-200 p-3">
            <input
              className="mb-2 w-full rounded border border-slate-300 px-2 py-1 text-sm"
              placeholder="Titolo preset"
              value={row.titolo ?? ''}
              onChange={(e) =>
                setPresetDimissione((prev) =>
                  prev.map((r, i) => (i === idx ? { ...r, titolo: e.target.value } : r)),
                )
              }
            />
            <textarea
              className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
              rows={3}
              placeholder="Testo note dimissione"
              value={row.testo ?? ''}
              onChange={(e) =>
                setPresetDimissione((prev) =>
                  prev.map((r, i) => (i === idx ? { ...r, testo: e.target.value } : r)),
                )
              }
            />
            <button
              type="button"
              className="mt-1 text-xs text-red-700"
              onClick={() => setPresetDimissione((prev) => prev.filter((_, i) => i !== idx))}
            >
              Rimuovi
            </button>
          </div>
        ))}
        <button
          type="button"
          className={btnSecondary}
          onClick={() => setPresetDimissione((prev) => [...prev, { titolo: '', testo: '' }])}
        >
          + Preset dimissione
        </button>
      </div>

      <div className="mb-6 grid gap-3">
        <label className="block text-xs font-bold uppercase text-slate-700">
          Consenso generico cure (PDF)
          <textarea
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
            rows={3}
            value={consensoCure}
            onChange={(e) => setConsensoCure(e.target.value)}
          />
        </label>
        <label className="block text-xs font-bold uppercase text-slate-700">
          Consenso privacy (PDF)
          <textarea
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
            rows={3}
            value={consensoPrivacy}
            onChange={(e) => setConsensoPrivacy(e.target.value)}
          />
        </label>
        <label className="block text-xs font-bold uppercase text-slate-700">
          Testo rifiuto invio PS (PDF)
          <textarea
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
            rows={3}
            value={rifiutoPs}
            onChange={(e) => setRifiutoPs(e.target.value)}
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={btnPrimary}
          disabled={saving}
          onClick={() => void persist(buildBase(), 'Impostazioni PMA salvate.')}
        >
          {saving ? 'Salvataggio…' : 'Salva impostazioni PMA'}
        </button>
      </div>

      <div className="mt-3">
        <SaveFeedback message={feedback} onClear={() => setFeedback('')} />
      </div>
    </section>
  );
}
