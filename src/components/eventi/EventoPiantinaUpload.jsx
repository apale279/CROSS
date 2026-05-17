import { useRef, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { useManifestazioneId } from '../../context/ManifestazioneContext';
import { uploadPiantinaEvento, deletePiantinaEvento } from '../../services/storageService';
import { patchEvento } from '../../services/eventiService';
import { btnDanger, btnSecondary } from '../ui/FormField';

export function EventoPiantinaUpload({ evento }) {
  const manifestationId = useManifestazioneId();
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);

  if (!evento?._docId) {
    return (
      <p className="text-sm text-slate-500">
        Salva l&apos;evento prima di caricare la piantina tattica.
      </p>
    );
  }

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
      const url = await uploadPiantinaEvento(manifestationId, evento._docId, file);
      await patchEvento(manifestationId, evento._docId, { piantina_url: url });
    } catch (err) {
      console.error(err);
      alert('Errore upload piantina: ' + (err.message ?? err));
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    if (!window.confirm('Rimuovere la piantina da questo evento?')) return;
    setRemoving(true);
    try {
      await deletePiantinaEvento(manifestationId, evento._docId);
      await patchEvento(manifestationId, evento._docId, { piantina_url: null });
    } catch (err) {
      console.error(err);
      alert('Errore rimozione: ' + (err.message ?? err));
    } finally {
      setRemoving(false);
    }
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50/80 p-4">
      <h3 className="mb-1 text-sm font-bold uppercase text-slate-700">Piantina evento (PNG)</h3>
      <p className="mb-4 text-sm text-slate-600">
        Usata nel tabellone tattico della dashboard. Solo immagini <strong>.png</strong>, salvate in
        Storage sotto <code className="text-xs">piantine_eventi/</code>.
      </p>

      {evento.piantina_url ? (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-lg border border-slate-300 bg-white">
            <img
              src={evento.piantina_url}
              alt="Anteprima piantina evento"
              className="max-h-64 w-full object-contain"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={btnSecondary}
              disabled={uploading || removing}
              onClick={() => inputRef.current?.click()}
            >
              Sostituisci PNG
            </button>
            <button
              type="button"
              className={`${btnDanger} inline-flex items-center gap-1`}
              disabled={uploading || removing}
              onClick={handleRemove}
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
          disabled={uploading}
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
  );
}
