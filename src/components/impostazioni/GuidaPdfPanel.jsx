import { useEffect, useRef, useState } from 'react';
import { ExternalLink, FileUp, Trash2 } from 'lucide-react';
import { useTenantContext } from '../../context/TenantContext';
import { useImpostazioniField } from '../../hooks/useImpostazioniField';
import {
  isValidGuidaPdfUrl,
  uploadGuidaPdf,
} from '../../services/guidaPdfUploadService';
import { GUIDA_PDF_ACCEPT, isCloudinaryGuidaConfigured } from '../../lib/guidaPdfConfig';
import { btnDanger, btnPrimary, btnSecondary, inputClass } from '../ui/FormField';
import { SaveFeedback } from './SaveFeedback';

export function GuidaPdfPanel() {
  const { tenantId } = useTenantContext();
  const {
    value: guidaUrl,
    saveField: saveGuidaUrl,
    saving,
    loading,
  } = useImpostazioniField('guida_pdf_url');

  const fileRef = useRef(null);
  const [urlDraft, setUrlDraft] = useState('');
  const [feedback, setFeedback] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!loading) setUrlDraft(guidaUrl ?? '');
  }, [loading, guidaUrl]);

  const cloudinaryReady = isCloudinaryGuidaConfigured();

  const saveUrl = async () => {
    const next = urlDraft.trim();
    if (next === (guidaUrl ?? '').trim()) return;
    if (next && !isValidGuidaPdfUrl(next)) {
      alert('URL non valido. Usa un link https:// pubblico verso il PDF.');
      return;
    }
    setFeedback('');
    try {
      await saveGuidaUrl(next || null);
      setFeedback(next ? 'Guida salvata.' : 'Guida rimossa.');
    } catch (err) {
      alert('Errore: ' + err.message);
    }
  };

  const removeGuida = async () => {
    if (!guidaUrl) return;
    if (!window.confirm('Rimuovere la guida PDF?')) return;
    setUrlDraft('');
    await saveGuidaUrl(null);
    setFeedback('Guida rimossa.');
  };

  const onPickFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !tenantId) return;
    setUploading(true);
    setFeedback('');
    try {
      const url = await uploadGuidaPdf(tenantId, file);
      setUrlDraft(url);
      await saveGuidaUrl(url);
      setFeedback('PDF caricato su Cloudinary e salvato.');
    } catch (err) {
      alert(err.message ?? 'Upload fallito');
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="mb-1 text-sm font-bold uppercase text-slate-800">Guida operativa (PDF)</h3>
      <p className="mb-4 text-sm text-slate-600">
        Manuale per gli operatori: visibile dal menu principale come link &quot;Guida&quot; quando
        è configurato. Carica un PDF su Cloudinary oppure incolla un URL pubblico.
      </p>

      <GuidaUploadBlock
        cloudinaryReady={cloudinaryReady}
        uploading={uploading}
        disabled={loading || saving}
        fileRef={fileRef}
        onPickFile={onPickFile}
      />

      <label className="mb-1 mt-4 block text-sm font-medium text-slate-700">URL PDF guida</label>
      <input
        type="url"
        className={`${inputClass} mb-3`}
        placeholder="https://res.cloudinary.com/.../guida.pdf"
        value={urlDraft}
        onChange={(e) => setUrlDraft(e.target.value)}
        disabled={loading}
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={btnPrimary}
          disabled={saving || loading || uploading}
          onClick={saveUrl}
        >
          {saving ? 'Salvataggio…' : 'Salva URL guida'}
        </button>
        {guidaUrl && (
          <button
            type="button"
            className={`${btnDanger} inline-flex items-center gap-1`}
            disabled={saving || uploading}
            onClick={removeGuida}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            Rimuovi
          </button>
        )}
        <SaveFeedback message={feedback} onClear={() => setFeedback('')} />
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-slate-500">Caricamento…</p>
      ) : (
        guidaUrl && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <a
              href={guidaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-semibold text-sky-700 hover:underline"
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
              Apri anteprima guida
            </a>
          </div>
        )
      )}
    </section>
  );
}

function GuidaUploadBlock({ cloudinaryReady, uploading, disabled, fileRef, onPickFile }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/80 p-4">
      <input
        ref={fileRef}
        type="file"
        accept={GUIDA_PDF_ACCEPT}
        className="sr-only"
        disabled={disabled || uploading}
        onChange={onPickFile}
      />
      <button
        type="button"
        className={`${btnSecondary} inline-flex items-center gap-2`}
        disabled={disabled || uploading}
        onClick={() => fileRef.current?.click()}
      >
        <FileUp className="h-4 w-4" aria-hidden />
        {uploading ? 'Caricamento…' : 'Carica PDF su Cloudinary'}
      </button>
      <p className="mt-2 text-xs text-slate-500">
        {cloudinaryReady
          ? 'Usa le variabili VITE_CLOUDINARY_* (preset unsigned con tipo Raw/PDF abilitato).'
          : 'Cloudinary client non configurato: serve upload via API (CLOUDINARY_* su Vercel) oppure incolla l’URL sotto.'}
      </p>
    </div>
  );
}
