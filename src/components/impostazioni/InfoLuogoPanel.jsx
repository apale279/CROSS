import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { useManifestazioneId } from '../../context/ManifestazioneContext';
import { useImpostazioniField } from '../../hooks/useImpostazioniField';
import { LuogoFisicoField } from '../maps/LuogoFisicoField';
import { uploadPiantinaInfoLuogo, deletePiantinaInfoLuogo } from '../../services/storageService';
import { btnDanger, btnSecondary } from '../ui/FormField';
import { SaveFeedback } from './SaveFeedback';

export function InfoLuogoPanel() {
  const manifestationId = useManifestazioneId();
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

  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [luogoDraft, setLuogoDraft] = useState('');
  const [luogoFeedback, setLuogoFeedback] = useState('');

  useEffect(() => {
    if (!loadingLuogo) setLuogoDraft(luogoFisico ?? '');
  }, [loadingLuogo, luogoFisico]);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.type !== 'image/png') {
      alert('Carica solo file .png');
      return;
    }
    setUploading(true);
    try {
      const url = await uploadPiantinaInfoLuogo(manifestationId, file);
      await savePiantinaUrl(url);
    } catch (err) {
      console.error(err);
      alert('Errore upload piantina: ' + (err.message ?? err));
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePiantina = async () => {
    if (!window.confirm('Rimuovere la piantina del luogo?')) return;
    setRemoving(true);
    try {
      await deletePiantinaInfoLuogo(manifestationId);
      await savePiantinaUrl(null);
    } catch (err) {
      console.error(err);
      alert('Errore rimozione: ' + (err.message ?? err));
    } finally {
      setRemoving(false);
    }
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

  const busy = uploading || removing || savingPiantina;

  return (
    <div className="grid gap-6">
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="mb-1 text-sm font-bold uppercase text-slate-800">Luogo fisico (manifestazione)</h3>
        <p className="mb-3 text-sm text-slate-600">
          Descrizione del sito in struttura chiusa (settore, tribuna, padiglione). Valida per tutto
          l&apos;evento operativo.
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
        <h3 className="mb-1 text-sm font-bold uppercase text-slate-800">Piantina tabellone tattico (PNG)</h3>
        <p className="mb-4 text-sm text-slate-600">
          Immagine usata nella dashboard → <strong>Mappa tattica</strong>. Solo file{' '}
          <strong>.png</strong>, salvati in Storage sotto{' '}
          <code className="text-xs">piantine_eventi/&#123;manifestazione&#125;/info_luogo.png</code>.
        </p>

        {loadingPiantina ? (
          <p className="text-sm text-slate-500">Caricamento…</p>
        ) : piantinaUrl ? (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-lg border border-slate-300 bg-white">
              <img
                src={piantinaUrl}
                alt="Anteprima piantina luogo"
                className="max-h-80 w-full object-contain"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={btnSecondary}
                disabled={busy}
                onClick={() => inputRef.current?.click()}
              >
                Sostituisci PNG
              </button>
              <button
                type="button"
                className={`${btnDanger} inline-flex items-center gap-1`}
                disabled={busy}
                onClick={handleRemovePiantina}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                Rimuovi piantina
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className={`${btnSecondary} inline-flex items-center gap-2`}
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            <ImagePlus className="h-4 w-4" aria-hidden />
            {uploading ? 'Caricamento…' : 'Carica piantina .png'}
          </button>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/png,.png"
          className="hidden"
          onChange={handleFile}
        />
      </section>
    </div>
  );
}
