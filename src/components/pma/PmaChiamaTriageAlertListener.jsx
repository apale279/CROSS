import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useAuth } from '../../context/AuthContext';
import { useManifestationId } from '../../context/ManifestazioneContext';
import { usePmaAccess } from '../../hooks/usePmaAccess';
import { useImpostazioni } from '../../hooks/useImpostazioni';
import { findPmaById } from '../../lib/pmaModule';
import { normalizePmaRank } from '../../lib/userAccess';
import {
  collectPmaChiamaTriageAlertsAttivi,
  pazienteChiamaTriageLabel,
  titoloAlertPmaChiamaTriage,
} from '../../lib/pmaChiamaTriageAlert';
import {
  startPmaChiamaTriageAlertLoop,
  stopPmaChiamaTriageAlertLoop,
  unlockPmaAlertAudio,
} from '../../lib/pmaAlertSound';
import { pazientiPath } from '../../lib/firestorePaths';
import { chiudiPmaChiamaTriage } from '../../services/pmaChiamaTriageAlertService';
import { btnPrimary, btnSecondary } from '../ui/FormField';

/**
 * Popup + suono per richieste ingresso pazienti in attesa (pulsante «Chiama» al desk).
 * Solo operatori con rank TRIAGE del PMA interessato.
 */
export function PmaChiamaTriageAlertListener() {
  const manifestationId = useManifestationId();
  const { user, profile } = useAuth();
  const { impostazioni } = useImpostazioni();
  const { scopeId, loading } = usePmaAccess();
  const [queue, setQueue] = useState([]);
  const [closing, setClosing] = useState(false);

  const isTriageOperator = normalizePmaRank(profile?.pmaRank) === 'Triage' && Boolean(scopeId);

  const listenEnabled = !loading && isTriageOperator && Boolean(manifestationId);

  useEffect(() => {
    const unlock = () => unlockPmaAlertAudio();
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => {
    if (!listenEnabled) {
      setQueue([]);
      stopPmaChiamaTriageAlertLoop();
    }
  }, [listenEnabled]);

  useEffect(() => {
    if (!listenEnabled || !manifestationId || !scopeId) return undefined;

    const colRef = collection(db, ...pazientiPath(manifestationId));
    return onSnapshot(
      colRef,
      (snap) => {
        try {
          setQueue(collectPmaChiamaTriageAlertsAttivi(snap.docs, scopeId));
        } catch (err) {
          console.error('[PmaChiamaTriageAlert] snapshot:', err);
        }
      },
      (err) => console.error('[PmaChiamaTriageAlert]', err),
    );
  }, [listenEnabled, manifestationId, scopeId]);

  const current = queue[0] ?? null;

  useEffect(() => {
    if (queue.length > 0) {
      startPmaChiamaTriageAlertLoop();
      return () => stopPmaChiamaTriageAlertLoop();
    }
    stopPmaChiamaTriageAlertLoop();
    return undefined;
  }, [queue.length]);

  const dismiss = async () => {
    if (!current || !manifestationId || closing) return;
    setClosing(true);
    try {
      await chiudiPmaChiamaTriage(manifestationId, current.pazienteDocId, {
        uid: user?.uid,
        nome: profile?.nome ?? user?.displayName ?? profile?.nomeUtente ?? '',
      });
    } catch (err) {
      console.error('[PmaChiamaTriageAlert] chiudi:', err);
      alert(err?.message ?? 'Errore chiusura alert');
    } finally {
      setClosing(false);
    }
  };

  if (!current) return null;

  const pma = findPmaById(impostazioni, current.pmaId);
  const pmaNome = pma?.nome ?? current.pmaId;
  const deskPath = `/pma/${encodeURIComponent(current.pmaId)}`;
  const chiamante = String(current.inviatoDa?.nome ?? '').trim();

  return createPortal(
    <div
      className="fixed inset-0 z-[2115] flex items-center justify-center bg-violet-950/60 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="pma-chiama-triage-alert-title"
    >
      <div className="w-full max-w-md rounded-xl border-4 border-violet-500 bg-white p-6 shadow-2xl">
        <p
          id="pma-chiama-triage-alert-title"
          className="text-center text-xl font-black leading-tight text-violet-900"
        >
          {titoloAlertPmaChiamaTriage()}
        </p>
        <p className="mt-2 text-center text-sm font-semibold text-slate-800">{pmaNome}</p>
        <p className="mt-3 text-center text-base text-slate-700">
          {pazienteChiamaTriageLabel(current.paziente)}
        </p>
        {chiamante ? (
          <p className="mt-2 text-center text-xs text-slate-500">Richiesta da {chiamante}</p>
        ) : null}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Link
            to={deskPath}
            className={`${btnPrimary} flex-1 text-center`}
            onClick={() => void dismiss()}
          >
            Apri desk PMA
          </Link>
          <button
            type="button"
            className={`${btnSecondary} flex-1`}
            disabled={closing}
            onClick={() => void dismiss()}
          >
            {closing ? '…' : 'Ho preso visione'}
          </button>
        </div>
        {queue.length > 1 ? (
          <p className="mt-3 text-center text-xs text-slate-500">
            +{queue.length - 1} altre richieste in coda
          </p>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
