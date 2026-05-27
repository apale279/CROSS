import { useRef, useState } from 'react';
import { Camera, ImagePlus, Trash2, X } from 'lucide-react';
import { btnDanger, btnSecondary } from '../ui/FormField';
import {
  deleteCodiceMinoreFoto,
  uploadCodiceMinoreFoto,
} from '../../services/pmaCodiceMinoreFotoService';
import { codiceMinoreFromPaziente } from '../../services/pmaCodiceMinoreService';

const thumbClass =
  'h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 object-cover';

export function PmaCodiceMinoreFotoStrip({
  manifestationId,
  pazienteDocId,
  row,
  busy,
  onFotoChange,
  compact = false,
}) {
  const galleryRef = useRef(null);
  const cameraRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [err, setErr] = useState(null);

  const canUpload = Boolean(pazienteDocId && manifestationId);
  const foto = codiceMinoreFromPaziente(row).foto;
  const disabled = busy || uploading || deletingId != null;

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !canUpload) return;
    setErr(null);
    setUploading(true);
    try {
      await uploadCodiceMinoreFoto(manifestationId, pazienteDocId, file);
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
      await deleteCodiceMinoreFoto(manifestationId, pazienteDocId, fotoMeta);
      if (previewUrl === fotoMeta.url) setPreviewUrl(null);
      onFotoChange?.();
    } catch (ex) {
      setErr(ex?.message ?? 'Eliminazione fallita');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold uppercase text-slate-500">Foto</span>
        {!canUpload ? (
          <span className="text-xs text-slate-500">Salva il record per allegare foto.</span>
        ) : null}
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
            {canUpload ? (
              <button
                type="button"
                className="absolute -right-1 -top-1 rounded-full border border-red-200 bg-white p-1 text-red-600 shadow-sm hover:bg-red-50 disabled:opacity-50"
                disabled={disabled}
                aria-label="Elimina foto"
                onClick={() => void handleDelete(f)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            ) : null}
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
            {canUpload && previewUrl ? (
              <div className="mt-3 flex justify-center">
                <button
                  type="button"
                  className={`${btnDanger} inline-flex items-center gap-2`}
                  disabled={disabled}
                  onClick={() => {
                    const meta = foto.find((f) => f.url === previewUrl);
                    if (meta) void handleDelete(meta);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Elimina foto
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
