import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useManifestazioneId } from '../context/ManifestazioneContext';
import { isPmaMedicoAccount } from '../lib/userAccess';
import { SignatureCanvas } from '../pma/components/scheda-paziente/SignatureCanvas';
import { resolveMedicoFirmaSrc } from '../pma/lib/medicoFirma';
import {
  buildMedicoFirmaPayloadFromFile,
  buildMedicoFirmaPayloadFromPng,
} from '../pma/lib/signatureSvg';
import {
  clearMedicoFirma,
  saveMedicoFirma,
  saveMedicoNotePersonali,
} from '../services/userProfileService';
import { btnPrimary, btnSecondary } from '../components/ui/FormField';

export default function AccountPage() {
  const manifestationId = useManifestazioneId();
  const { user, profile, profileLoading, refreshProfile } = useAuth();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const [canvasKey, setCanvasKey] = useState(0);
  const [notePersonaliDraft, setNotePersonaliDraft] = useState(
    () => String(profile?.note_personali ?? ''),
  );
  const [noteBusy, setNoteBusy] = useState(false);

  useEffect(() => {
    setNotePersonaliDraft(String(profile?.note_personali ?? ''));
  }, [profile?.note_personali]);

  if (profileLoading) {
    return <p className="p-8 text-sm text-slate-500">Caricamento profilo…</p>;
  }

  if (!isPmaMedicoAccount(profile)) {
    return <Navigate to="/" replace />;
  }

  const firmaPreview = resolveMedicoFirmaSrc(profile);

  async function onSaveNotePersonali() {
    if (!manifestationId || !user?.uid) return;
    setNoteBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await saveMedicoNotePersonali(manifestationId, user.uid, notePersonaliDraft);
      await refreshProfile();
      setMsg('Note personali salvate.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Salvataggio note non riuscito.');
    } finally {
      setNoteBusy(false);
    }
  }

  async function persistFirma(pngDataUrl, svgDataUrl) {
    if (!manifestationId || !user?.uid) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await saveMedicoFirma(manifestationId, user.uid, { pngDataUrl, svgDataUrl });
      await refreshProfile();
      setMsg('Firma salvata.');
      setCanvasKey((k) => k + 1);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Salvataggio non riuscito.');
    } finally {
      setBusy(false);
    }
  }

  async function onCanvasSave(pngDataUrl) {
    const payload = await buildMedicoFirmaPayloadFromPng(pngDataUrl);
    await persistFirma(payload.pngDataUrl, payload.svgDataUrl);
  }

  async function onFileChange(ev) {
    const file = ev.target.files?.[0];
    ev.target.value = '';
    if (!file) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const payload = await buildMedicoFirmaPayloadFromFile(file);
      await persistFirma(payload.pngDataUrl, payload.svgDataUrl);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Caricamento file non riuscito.');
    } finally {
      setBusy(false);
    }
  }

  async function onRemoveFirma() {
    if (!manifestationId || !user?.uid) return;
    if (!window.confirm('Rimuovere la firma dal profilo?')) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await clearMedicoFirma(manifestationId, user.uid);
      await refreshProfile();
      setMsg('Firma rimossa.');
      setCanvasKey((k) => k + 1);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Operazione non riuscita.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <h1 className="text-xl font-bold text-slate-900">Account</h1>
      <p className="mt-1 text-sm text-slate-600">
        {profile?.nome || user?.displayName || 'Medico PMA'} — firma usata in dimissione e PDF.
      </p>

      {msg ? (
        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{msg}</p>
      ) : null}
      {err ? (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {err}
        </p>
      ) : null}

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Note personali</h2>
        <p className="mt-1 text-xs text-slate-500">
          Promemoria privati visibili all&apos;inizio della scheda dimissione (solo per il tuo
          account). Non vengono stampati nel PDF.
        </p>
        <textarea
          rows={6}
          disabled={noteBusy || busy}
          value={notePersonaliDraft}
          onChange={(e) => setNotePersonaliDraft(e.target.value)}
          placeholder="Es. Ricorda antitetanica se ferito; verifica consenso se minore…"
          className="mt-3 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
        />
        <button
          type="button"
          className={`${btnPrimary} mt-3`}
          disabled={noteBusy || busy}
          onClick={() => void onSaveNotePersonali()}
        >
          Salva note personali
        </button>
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Firma</h2>
        <p className="mt-1 text-xs text-slate-500">
          Disegna la firma o carica un&apos;immagine (PNG/JPG). Viene convertita in SVG e associata al
          tuo account; in dimissione compare la firma del medico che dimette.
        </p>

        {firmaPreview ? (
          <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Firma attuale</p>
            <img
              src={firmaPreview}
              alt="Firma medico salvata"
              className="max-h-32 w-full object-contain"
            />
            <button
              type="button"
              className={`${btnSecondary} mt-3`}
              disabled={busy}
              onClick={() => void onRemoveFirma()}
            >
              Rimuovi firma
            </button>
          </div>
        ) : (
          <p className="mt-3 text-sm italic text-slate-500">Nessuna firma registrata.</p>
        )}

        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Nuova firma</p>
          <SignatureCanvas
            key={canvasKey}
            disabled={busy}
            preloadImageSrc={null}
            variant="compact"
            onSaveDataUrl={onCanvasSave}
          />
        </div>

        <div className="mt-4">
          <label className="block text-xs font-semibold uppercase text-slate-500">
            Carica immagine
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              disabled={busy}
              className="mt-2 block w-full text-sm text-slate-700 file:mr-3 file:rounded file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-semibold"
              onChange={(e) => void onFileChange(e)}
            />
          </label>
        </div>
      </section>
    </div>
  );
}
