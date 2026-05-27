import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useAuth } from '../../context/AuthContext';
import { useManifestationId } from '../../context/ManifestazioneContext';
import { usePmaAccess } from '../../hooks/usePmaAccess';
import {
  startPmaAlertSoundLoop,
  stopPmaAlertSoundLoop,
  unlockPmaAlertAudio,
} from '../../lib/pmaAlertSound';
import {
  collectDiarioPmaAlertsAttivi,
  truncateDiarioAlertTesto,
} from '../../lib/pmaDiarioAlert';
import { noteDiarioPath } from '../../lib/firestorePaths';
import { chiudiPmaAlertDiario } from '../../services/diarioPmaAlertService';
import { btnPrimary, btnSecondary } from '../ui/FormField';

/**
 * Popup + suono per note diario importanti con ALLERTA PMA dalla centrale.
 * Chiusura su Firestore: il primo operatore PMA la chiude per tutti.
 */
export function PmaDiarioAlertListener() {
  const manifestationId = useManifestationId();
  const { pathname } = useLocation();
  const { user, profile } = useAuth();
  const { scopeId, isPmaOperator, loading } = usePmaAccess();
  const [queue, setQueue] = useState([]);
  const [closing, setClosing] = useState(false);

  const onPmaArea = pathname === '/pma' || pathname.startsWith('/pma/');
  const listenEnabled = !loading && (isPmaOperator || Boolean(scopeId) || onPmaArea);

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
      stopPmaAlertSoundLoop();
    }
  }, [listenEnabled]);

  useEffect(() => {
    if (!listenEnabled || !manifestationId) return undefined;

    const colRef = collection(db, ...noteDiarioPath(manifestationId));
    return onSnapshot(
      colRef,
      (snap) => {
        try {
          setQueue(collectDiarioPmaAlertsAttivi(snap.docs));
        } catch (err) {
          console.error('[PmaDiarioAlert] snapshot:', err);
        }
      },
      (err) => console.error('[PmaDiarioAlert]', err),
    );
  }, [listenEnabled, manifestationId]);

  const current = queue[0] ?? null;

  useEffect(() => {
    if (queue.length > 0) {
      startPmaAlertSoundLoop();
      return () => stopPmaAlertSoundLoop();
    }
    stopPmaAlertSoundLoop();
    return undefined;
  }, [queue.length]);

  const dismiss = async () => {
    if (!current || !manifestationId || closing) return;
    setClosing(true);
    try {
      await chiudiPmaAlertDiario(manifestationId, current.notaDocId, {
        uid: user?.uid,
        nome: profile?.nome ?? user?.displayName ?? profile?.nomeUtente ?? '',
      });
    } catch (err) {
      console.error('[PmaDiarioAlert] chiudi:', err);
      alert(err?.message ?? 'Errore chiusura alert');
    } finally {
      setClosing(false);
    }
  };

  if (!current) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[2110] flex items-center justify-center bg-amber-950/65 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="pma-diario-alert-title"
    >
      <div className="w-full max-w-md rounded-xl border-4 border-amber-500 bg-white p-6 shadow-2xl">
        <p
          id="pma-diario-alert-title"
          className="text-center text-xl font-black leading-tight text-amber-900"
        >
          Allerta diario dalla centrale
        </p>
        <p className="mt-2 text-center text-sm font-semibold text-slate-800">{current.titolo}</p>
        <p className="mt-3 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-sm text-slate-800">
          {truncateDiarioAlertTesto(current.testo)}
        </p>
        <p className="mt-2 text-center text-xs text-slate-500">
          Nota importante. La chiusura vale per tutti i desk PMA collegati.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Link
            to="/diario"
            className={`${btnSecondary} flex-1 text-center`}
            onClick={() => void dismiss()}
          >
            Apri diario
          </Link>
          <button
            type="button"
            className={`${btnPrimary} flex-1`}
            disabled={closing}
            onClick={() => void dismiss()}
          >
            {closing ? '…' : 'Ho preso visione'}
          </button>
        </div>
        {queue.length > 1 ? (
          <p className="mt-3 text-center text-xs text-slate-500">
            +{queue.length - 1} altre allerte diario in coda
          </p>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
