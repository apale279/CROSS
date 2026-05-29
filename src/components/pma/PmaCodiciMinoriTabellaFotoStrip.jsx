import { useRef, useState } from 'react';
import { Camera, ImagePlus, Trash2, X } from 'lucide-react';
import { btnDanger, btnSecondary } from '../ui/FormField';
import {
  appendCodiciMinoriTabellaFoto,
  codiciMinoriTabellaFotoList,
  deleteCodiciMinoriTabellaFoto,
} from '../../services/pmaCodiciMinoriTabellaFotoService';

const thumbClass =
  'h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 object-cover';

export function PmaCodiciMinoriTabellaFotoStrip({
  manifestationId,
  pmaId,
  impostazioni,
  busy,
  onFotoChange,
}) {
  const galleryRef = useRef(null);
  const cameraRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [err, setErr] = useState(null);

  const canUpload = Boolean(pmaId && manifestationId);
  const foto = codiciMinoriTabellaFotoList(impostazioni, pmaId);
  const disabled = busy || uploading || deletingId != null;

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !canUpload) return;
    setErr(null);
    setUploading(true);
    try {
      await appendCodiciMinoriTabellaFoto(manifestationId, pmaId, impostazioni, file);
      onFotoChange?.();
    } catch (ex) {
      setErr(ex?.message ?? 'Upload fallito');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (fotoMeta) => {
    if (!window.confirm('Eliminare questa foto?')) return;
    setErr(null);
    setDeletingId(fotoMeta.id);
    try {
      await deleteCodiciMinoriTabellaFoto(manifestationId, pmaId, impostazioni, fotoMeta);
      if (previewUrl === fotoMeta.url) setPreviewUrl(null);
      onFotoChange?.();
    } catch (ex) {
      setErr(ex?.message ?? 'Eliminazione fallita');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
      <div>
        <p className="text-xs font-bold uppercase text-slate-700">Foto tabella compilata</p>
        <p className="mt-0.5 text-xs text-slate-600">
          Allegati generali della tabella codici minori (es. foglio cartaceo fotografato per copia a PC).
        </p>
      </div>

      <div className="flex flex-wrap items-start gap-2">
        {foto.map((f) => (
          <div key={f.id} className="group relative">
            <button
              type="button"
              className={thumbClass}
              disabled={disabled}
              onClick={() => setPreviewUrl(f.url)}
              title="Ingrandisci"
            >
              <img src={f.url} alt="" className="h-full w-full object-cover" />
            </button>
            <button
              type="button"
              className="absolute -right-1 -top-1 rounded-full border border-red-200 bg-white p-1 text-red-600 shadow-sm hover:bg-red-50 disabled:opacity-50"
              disabled={disabled}
              aria-label="Elimina foto"
              onClick={() => void handleDelete(f)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}

        {canUpload ? (
          <>
            <input
              ref={galleryRef}
              type="file"
              accept="image/*"
              className="sr-only"
              aria-hidden
              tabIndex={-1}
              onChange={(e) => void handleFile(e)}
            />
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              aria-hidden
              tabIndex={-1}
              onChange={(e) => void handleFile(e)}
            />
            <button
              type="button"
              className={`${btnSecondary} flex h-16 w-16 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border-dashed px-1 text-[10px] leading-tight`}
              disabled={disabled}
              onClick={() => galleryRef.current?.click()}
            >
              <ImagePlus className="h-5 w-5 shrink-0" aria-hidden />
              {uploading ? '…' : 'Galleria'}
            </button>
            <button
              type="button"
              className={`${btnSecondary} flex h-16 w-16 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border-dashed px-1 text-[10px] leading-tight`}
              disabled={disabled}
              onClick={() => cameraRef.current?.click()}
              title="Scatta foto"
            >
              <Camera className="h-5 w-5 shrink-0" aria-hidden />
              Camera
            </button>
          </>
        ) : null}
      </div>

      {err ? (
        <p className="text-xs text-red-600" role="alert">
          {err}
        </p>
      ) : null}

      {previewUrl ? (
        <div
          className="fixed inset-0 z-[3000] flex items-center justify-center bg-slate-900/80 p-4"
          role="presentation"
          onClick={() => setPreviewUrl(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-full"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Anteprima foto"
          >
            <button
              type="button"
              className="absolute -right-2 -top-2 z-10 rounded-full bg-white p-2 shadow-lg"
              aria-label="Chiudi anteprima"
              onClick={() => setPreviewUrl(null)}
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={previewUrl}
              alt=""
              className="max-h-[85vh] max-w-[min(100vw-2rem,48rem)] rounded-lg object-contain"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
