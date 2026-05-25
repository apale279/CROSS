import { useEffect, useRef, useState } from 'react';
import { useManifestazioneId } from '../../context/ManifestazioneContext';
import { FormField, btnPrimary, btnSecondary, inputClass } from '../ui/FormField';
import { isCloudinaryDiarioPdfConfigured, uploadDiarioPdf } from '../../services/diarioPdfUploadService';

const empty = () => ({ titolo: '', testo: '', importante: false, pdfUrl: '', pdfFilename: '' });

export function DiarioNotaForm({ nota, saving, onSave, onCancel }) {
  const manifestationId = useManifestazioneId();
  const fileRef = useRef(null);
  const [draft, setDraft] = useState(empty);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState('');

  useEffect(() => {
    if (nota) {
      setDraft({
        titolo: nota.titolo ?? '',
        testo: nota.testo ?? '',
        importante: nota.importante === true,
        pdfUrl: nota.pdfUrl ?? '',
        pdfFilename: nota.pdfFilename ?? '',
      });
    } else {
      setDraft(empty());
    }
  }, [nota]);

  const onPickPdf = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadErr('');
    setUploading(true);
    try {
      const { pdfUrl, pdfFilename } = await uploadDiarioPdf(manifestationId, file);
      setDraft((d) => ({ ...d, pdfUrl, pdfFilename }));
    } catch (err) {
      setUploadErr(err?.message ?? 'Upload PDF non riuscito');
    } finally {
      setUploading(false);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    const titolo = draft.titolo.trim();
    if (!titolo) {
      alert('Il titolo nota è obbligatorio.');
      return;
    }
    onSave?.({
      titolo,
      testo: draft.testo.trim(),
      importante: draft.importante,
      pdfUrl: draft.pdfUrl.trim() || null,
      pdfFilename: draft.pdfFilename.trim() || null,
    });
  };

  const cloudinaryReady = isCloudinaryDiarioPdfConfigured();

  return (
    <form onSubmit={submit} className="space-y-4">
      <FormField label="Titolo nota">
        <input
          className={inputClass}
          value={draft.titolo}
          onChange={(e) => setDraft((d) => ({ ...d, titolo: e.target.value }))}
          required
          autoFocus
        />
      </FormField>
      <FormField label="Testo nota">
        <textarea
          className={inputClass}
          rows={6}
          value={draft.testo}
          onChange={(e) => setDraft((d) => ({ ...d, testo: e.target.value }))}
        />
      </FormField>
      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-700">Allegato PDF (opzionale)</p>
        {cloudinaryReady ? (
          <div className="flex flex-wrap items-center gap-2">
            <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={onPickPdf} />
            <button
              type="button"
              className={btnSecondary}
              disabled={saving || uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? 'Caricamento…' : draft.pdfUrl ? 'Sostituisci PDF' : 'Allega PDF'}
            </button>
            {draft.pdfFilename ? (
              <span className="text-sm text-slate-600">{draft.pdfFilename}</span>
            ) : null}
            {draft.pdfUrl ? (
              <button
                type="button"
                className="text-sm font-medium text-red-700 hover:underline"
                disabled={saving || uploading}
                onClick={() => setDraft((d) => ({ ...d, pdfUrl: '', pdfFilename: '' }))}
              >
                Rimuovi
              </button>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-amber-800">
            Upload PDF non configurato (variabili Cloudinary mancanti).
          </p>
        )}
        {uploadErr ? (
          <p className="text-xs text-red-700" role="alert">
            {uploadErr}
          </p>
        ) : null}
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={draft.importante}
          onChange={(e) => setDraft((d) => ({ ...d, importante: e.target.checked }))}
        />
        Nota importante (evidenziata in dashboard)
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={btnPrimary} disabled={saving || uploading}>
          {saving ? 'Salvataggio…' : nota ? 'Salva modifiche' : 'Crea nota'}
        </button>
        {onCancel && (
          <button type="button" className={btnSecondary} disabled={saving || uploading} onClick={onCancel}>
            Annulla
          </button>
        )}
      </div>
    </form>
  );
}
