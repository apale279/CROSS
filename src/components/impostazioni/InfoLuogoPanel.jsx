import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useImpostazioniField } from '../../hooks/useImpostazioniField';
import { LuogoFisicoField } from '../maps/LuogoFisicoField';
import { isValidPiantinaUrl } from '../../services/piantinaUploadService';
import { btnDanger, btnPrimary, btnSecondary, inputClass } from '../ui/FormField';
import { SaveFeedback } from './SaveFeedback';

export function InfoLuogoPanel() {
  const {
    value: piantinaUrl,
    saveField: savePiantinaUrl,
    saving: savingPiantina,
    loading: loadingPiantina,
  } = useImpostazioniField('piantina_url');
  const {
    value: luogoFisico,
    saveField: saveLuogoFisico,
    saving: savingLuogo,
    loading: loadingLuogo,
  } = useImpostazioniField('luogo_fisico');

  const [luogoDraft, setLuogoDraft] = useState('');
  const [luogoFeedback, setLuogoFeedback] = useState('');
  const [urlDraft, setUrlDraft] = useState('');
  const [urlFeedback, setUrlFeedback] = useState('');

  useEffect(() => {
    if (!loadingLuogo) setLuogoDraft(luogoFisico ?? '');
  }, [loadingLuogo, luogoFisico]);

  useEffect(() => {
    if (!loadingPiantina) setUrlDraft(piantinaUrl ?? '');
  }, [loadingPiantina, piantinaUrl]);

  const saveUrl = async () => {
    const next = urlDraft.trim();
    if (next === (piantinaUrl ?? '').trim()) return;
    if (next && !isValidPiantinaUrl(next)) {
      alert('URL non valido. Usa un link https:// pubblico verso l’immagine.');
      return;
    }
    setUrlFeedback('');
    try {
      await savePiantinaUrl(next || null);
      setUrlFeedback(next ? 'Piantina salvata.' : 'Piantina rimossa.');
    } catch (err) {
      alert('Errore: ' + err.message);
    }
  };

  const removePiantina = async () => {
    if (!piantinaUrl) return;
    if (!window.confirm('Rimuovere la piantina?')) return;
    setUrlDraft('');
    await savePiantinaUrl(null);
    setUrlFeedback('Piantina rimossa.');
  };

  const saveLuogo = async () => {
    const next = luogoDraft.trim();
    if (next === (luogoFisico ?? '').trim()) return;
    setLuogoFeedback('');
    try {
      await saveLuogoFisico(next);
      setLuogoFeedback('Luogo fisico salvato.');
    } catch (err) {
      alert('Errore: ' + err.message);
    }
  };

  return (
    <div className="grid gap-6">
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="mb-1 text-sm font-bold uppercase text-slate-800">Luogo fisico (manifestazione)</h3>
        <p className="mb-3 text-sm text-slate-600">
          Descrizione del sito in struttura chiusa (settore, tribuna, padiglione).
        </p>
        <LuogoFisicoField
          value={luogoDraft}
          onChange={setLuogoDraft}
          className="[&_p]:hidden"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={btnSecondary}
            disabled={savingLuogo || loadingLuogo}
            onClick={saveLuogo}
          >
            {savingLuogo ? 'Salvataggio…' : 'Salva luogo fisico'}
          </button>
          <SaveFeedback message={luogoFeedback} onClear={() => setLuogoFeedback('')} />
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-slate-50/80 p-4">
        <h3 className="mb-1 text-sm font-bold uppercase text-slate-800">Piantina tabellone tattico</h3>
        <p className="mb-4 text-sm text-slate-600">
          Usata in dashboard → <strong>Mappa tattica</strong>. Incolla l&apos;URL di un&apos;immagine
          già ospitata da te (Cloudinary, sito, Drive con link pubblico, ecc.). Formati: PNG, JPG,
          WebP o SVG.
        </p>

        <label className="mb-1 block text-sm font-medium text-slate-700">URL immagine piantina</label>
        <input
          type="url"
          className={`${inputClass} mb-3`}
          placeholder="https://esempio.com/piantina.png"
          value={urlDraft}
          onChange={(e) => setUrlDraft(e.target.value)}
          disabled={loadingPiantina}
        />

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={btnPrimary}
            disabled={savingPiantina || loadingPiantina}
            onClick={saveUrl}
          >
            {savingPiantina ? 'Salvataggio…' : 'Salva piantina'}
          </button>
          {piantinaUrl && (
            <button
              type="button"
              className={`${btnDanger} inline-flex items-center gap-1`}
              disabled={savingPiantina}
              onClick={removePiantina}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              Rimuovi
            </button>
          )}
          <SaveFeedback message={urlFeedback} onClear={() => setUrlFeedback('')} />
        </div>

        {loadingPiantina ? (
          <p className="mt-4 text-sm text-slate-500">Caricamento…</p>
        ) : (
          piantinaUrl && (
            <div className="mt-4 overflow-hidden rounded-lg border border-slate-300 bg-white">
              <img
                src={piantinaUrl}
                alt="Anteprima piantina"
                className="max-h-80 w-full object-contain"
                onError={() =>
                  setUrlFeedback('Anteprima non caricata: verifica che l’URL sia pubblico.')
                }
              />
            </div>
          )
        )}
      </section>
    </div>
  );
}
