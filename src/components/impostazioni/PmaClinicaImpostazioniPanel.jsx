import { useCallback, useEffect, useState } from 'react';

import { parseLinesToValues } from '../../pma/lib/multilineList';

import { parseFarmaciCatalogoFromFirestore, serializeFarmaciCatalogo } from '../../pma/types/farmaciCatalogo';

import { useImpostazioniField } from '../../hooks/useImpostazioniField';

import { FarmaciConsumatiEditor } from './FarmaciConsumatiEditor';

import { btnPrimary, btnSecondary } from '../ui/FormField';

import { SaveFeedback } from './SaveFeedback';



export function PmaClinicaImpostazioniPanel() {

  const { value: pmaClinica, saveField, saving, loading } = useImpostazioniField('pmaClinica');

  const [feedback, setFeedback] = useState('');

  const [prestazioniDraft, setPrestazioniDraft] = useState('');

  const [farmaciConsumati, setFarmaciConsumati] = useState([]);

  const [consensoCure, setConsensoCure] = useState('');

  const [consensoPrivacy, setConsensoPrivacy] = useState('');

  const [rifiutoPs, setRifiutoPs] = useState('');

  const [presetDimissione, setPresetDimissione] = useState([]);



  useEffect(() => {

    if (loading) return;

    const pc = pmaClinica ?? {};

    setPrestazioniDraft((pc.prestazioni ?? []).join('\n'));

    setFarmaciConsumati(

      serializeFarmaciCatalogo(

        parseFarmaciCatalogoFromFirestore(pc.farmaci_consumati ?? pc.farmaci),

      ),

    );

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

      farmaci: _legacyFarmaci,

      ...restPma

    } = pmaClinica ?? {};

    return {

      ...restPma,

      prestazioni: parseLinesToValues(prestazioniDraft),

      farmaci: [],

      farmaci_consumati: farmaciConsumati,

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

        Catalogo farmaci consumati, prestazioni e testi legali PDF. L&apos;EO rapido in cartella clinica è definito

        nel codice (modello strutturato Excel).

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



      <div className="mb-6">

        <FarmaciConsumatiEditor

          value={farmaciConsumati}

          onChange={setFarmaciConsumati}

          disabled={saving}

        />

      </div>



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

