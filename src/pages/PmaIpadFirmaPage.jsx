import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useManifestationIdOptional } from '../context/ManifestazioneContext';
import { useTenantContext } from '../context/TenantContext';
import { useImpostazioni } from '../hooks/useImpostazioni';
import { findPmaById } from '../lib/pmaModule';
import { pmaIpadCredentialsFromEntry } from '../lib/pmaIpadCredentials';
import {
  completePmaIpadFirmaRequest,
  parsePmaIpadQueueRequest,
  signInPmaIpadKiosk,
  subscribePmaIpadFirmaQueue,
} from '../services/pmaIpadFirmaService';
import { SignatureCanvas } from '../pma/components/scheda-paziente/SignatureCanvas';
import { AppVersionBadge } from '../components/ui/AppVersionBadge';

/** Vista iPad: login automatico con credenziali del PMA + coda firme. */
export default function PmaIpadFirmaPage() {
  const { pmaId: pmaIdParam } = useParams();
  const pmaId = decodeURIComponent(pmaIdParam ?? '');

  const { loading: tenantLoading } = useTenantContext();
  const tenantId = useManifestationIdOptional();
  const { impostazioni, loading: impostazioniLoading } = useImpostazioni();
  const { user, loading: authLoading } = useAuth();

  const pma = useMemo(() => findPmaById(impostazioni, pmaId), [impostazioni, pmaId]);
  const pmaWithCreds = useMemo(
    () => (pma ? { ...pma, ...pmaIpadCredentialsFromEntry(pma) } : null),
    [pma],
  );

  const [phase, setPhase] = useState('pairing');
  const [pairErr, setPairErr] = useState(null);
  const [queueDoc, setQueueDoc] = useState(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveErr, setSaveErr] = useState(null);
  const [doneMsg, setDoneMsg] = useState('');
  const [firmaFullScreen, setFirmaFullScreen] = useState(false);

  const activeRequest = useMemo(() => parsePmaIpadQueueRequest(queueDoc), [queueDoc]);

  const runLogin = useCallback(async () => {
    if (!tenantId || !pmaId || !pmaWithCreds) return;
    setPairErr(null);
    try {
      await signInPmaIpadKiosk(tenantId, pmaId, pmaWithCreds.nome, pmaWithCreds);
      setPhase('ready');
    } catch (e) {
      setPairErr(e instanceof Error ? e.message : 'Accesso iPad non riuscito.');
      setPhase('pairing');
    }
  }, [tenantId, pmaId, pmaWithCreds]);

  useEffect(() => {
    if (!tenantId || !pmaId || !pmaWithCreds || authLoading) return;
    if (user) {
      setPhase('ready');
      return;
    }
    void runLogin();
  }, [tenantId, pmaId, pmaWithCreds, user, authLoading, runLogin]);

  useEffect(() => {
    if (phase !== 'ready' || !tenantId || !pmaId) return undefined;
    return subscribePmaIpadFirmaQueue(tenantId, pmaId, setQueueDoc);
  }, [phase, tenantId, pmaId]);

  useEffect(() => {
    if (activeRequest?.status === 'pending') {
      setDoneMsg('');
      setSaveErr(null);
      setFirmaFullScreen(false);
    }
  }, [activeRequest?.id]);

  async function handleSaveFirma(dataUrl) {
    if (!tenantId || !pmaId || !activeRequest || activeRequest.status !== 'pending') return;
    setSaveBusy(true);
    setSaveErr(null);
    try {
      await completePmaIpadFirmaRequest(
        tenantId,
        pmaId,
        activeRequest.id,
        activeRequest.pazienteDocId,
        dataUrl,
      );
      setDoneMsg(
        `Firma salvata per ${activeRequest.idPaziente || 'paziente'}. In attesa del prossimo documento…`,
      );
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : 'Salvataggio firma non riuscito.');
      throw e;
    } finally {
      setSaveBusy(false);
    }
  }

  if (tenantLoading || impostazioniLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-sm text-slate-600">
        Caricamento…
      </div>
    );
  }

  if (!tenantId) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-sm text-slate-600">
        Manifestazione non configurata.
      </div>
    );
  }

  if (!pma) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 p-6 text-center text-sm text-slate-600">
        <p>PMA non trovato.</p>
        {pmaId ? (
          <p className="font-mono text-xs text-slate-500">
            ID richiesto: <span className="break-all">{pmaId}</span>
          </p>
        ) : null}
      </div>
    );
  }

  if (phase === 'pairing') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-900 p-6 text-center text-white">
        <p className="text-lg font-bold">{pma.nome}</p>
        {authLoading || !pairErr ? (
          <p className="text-sm text-slate-300">Accesso iPad in corso…</p>
        ) : (
          <>
            <p className="max-w-md text-sm text-red-300" role="alert">
              {pairErr}
            </p>
            <button
              type="button"
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900"
              onClick={() => void runLogin()}
            >
              Riprova accesso
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="pma-viewport fixed inset-0 z-[100] flex min-h-0 flex-col bg-slate-100">
      <header className="shrink-0 border-b border-slate-300 bg-teal-900 px-4 py-3 text-white">
        <AppVersionBadge className="mb-2 border-teal-600 bg-teal-800 text-teal-100" />
        <p className="text-xs font-bold uppercase tracking-wider text-teal-200">iPad firma PMA</p>
        <h1 className="text-xl font-bold">{pma.nome}</h1>
      </header>

      {!activeRequest || activeRequest.status !== 'pending' ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="text-lg font-semibold text-slate-800">In attesa di documento</p>
          <p className="max-w-md text-sm text-slate-600">
            Dal PC, in dimissione, invia il PDF con «Invia documento a iPad per firma».
          </p>
          {doneMsg ? (
            <p
              className="rounded-lg bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-900"
              role="status"
            >
              {doneMsg}
            </p>
          ) : null}
        </div>
      ) : firmaFullScreen ? (
        <div className="flex min-h-0 flex-1 flex-col bg-white">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
            <button
              type="button"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
              onClick={() => setFirmaFullScreen(false)}
            >
              ← Anteprima PDF
            </button>
            <p className="text-sm font-semibold text-slate-800">Firma del paziente</p>
            <span className="w-24" aria-hidden />
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
            <p className="shrink-0 text-center font-mono text-lg font-bold text-teal-900">
              {activeRequest.idPaziente || 'Paziente'}
            </p>
            <SignatureCanvas
              key={`${activeRequest.id}-fs`}
              className="min-h-0 flex-1"
              onSaveDataUrl={handleSaveFirma}
            />
            {saveBusy ? <p className="text-center text-xs text-slate-500">Salvataggio…</p> : null}
            {saveErr ? (
              <p className="text-center text-xs text-red-800" role="alert">
                {saveErr}
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <section className="flex min-h-0 flex-[3] flex-col border-b border-slate-300">
            <div className="shrink-0 border-b border-slate-200 bg-white px-3 py-2">
              <p className="font-mono text-lg font-bold text-teal-900">
                {activeRequest.idPaziente || 'Paziente'}
              </p>
              <p className="text-xs text-slate-600">
                Richiesto da {activeRequest.requestedByNome || 'operatore'}
              </p>
            </div>
            <div className="min-h-0 flex-1 bg-slate-200">
              {activeRequest.pdfPreviewUrl ? (
                <iframe
                  title="Anteprima documento"
                  src={activeRequest.pdfPreviewUrl}
                  className="h-full w-full border-0 bg-white"
                />
              ) : (
                <p className="p-6 text-sm text-slate-600">Anteprima PDF non disponibile.</p>
              )}
            </div>
          </section>

          <section className="flex min-h-0 flex-[2] flex-col gap-2 bg-white p-3">
            <div className="flex shrink-0 items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-800">Firma del paziente</p>
              <button
                type="button"
                className="rounded-lg bg-teal-800 px-3 py-2 text-xs font-bold uppercase tracking-wide text-white"
                onClick={() => setFirmaFullScreen(true)}
              >
                Schermo intero firma
              </button>
            </div>
            <SignatureCanvas
              key={activeRequest.id}
              className="min-h-0 flex-1"
              onSaveDataUrl={handleSaveFirma}
            />
            {saveBusy ? <p className="shrink-0 text-xs text-slate-500">Salvataggio…</p> : null}
            {saveErr ? (
              <p className="shrink-0 text-xs text-red-800" role="alert">
                {saveErr}
              </p>
            ) : null}
          </section>
        </div>
      )}
    </div>
  );
}
