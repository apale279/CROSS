import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Send, X } from 'lucide-react';
import { useManifestazioneId } from '../../context/ManifestazioneContext';
import { sendMissionToTelegram } from '../../services/telegramService';
import { findEventoForMissione } from '../../lib/telegramMissionPayload';

const statusKey = (tenantId, missionDocId) => `cross-tg-send:${tenantId}:${missionDocId}`;

function readStoredStatus(tenantId, missionDocId) {
  try {
    const v = sessionStorage.getItem(statusKey(tenantId, missionDocId));
    if (v === 'ok' || v === 'err') return v;
  } catch {
    /* ignore */
  }
  return null;
}

function storeStatus(tenantId, missionDocId, status) {
  try {
    if (status) sessionStorage.setItem(statusKey(tenantId, missionDocId), status);
    else sessionStorage.removeItem(statusKey(tenantId, missionDocId));
  } catch {
    /* ignore */
  }
}

export function MissioneTelegramSendButton({
  missione,
  eventi = [],
  evento: eventoProp,
  telegramEnabled,
  className = '',
}) {
  const manifestationId = useManifestazioneId();
  const missionDocId = missione?._docId ?? missione?.idMissione ?? '';
  const [sendStatus, setSendStatus] = useState(() =>
    readStoredStatus(manifestationId, missionDocId),
  );
  const inFlightRef = useRef(false);

  useEffect(() => {
    setSendStatus(readStoredStatus(manifestationId, missionDocId));
  }, [manifestationId, missionDocId]);

  if (!missione?.mezzo) return null;

  const evento = eventoProp ?? findEventoForMissione(eventi, missione);
  const disabled = !telegramEnabled;

  const runSend = useCallback(() => {
    if (!telegramEnabled || inFlightRef.current) return;
    inFlightRef.current = true;
    setSendStatus(null);
    storeStatus(manifestationId, missionDocId, null);

    void (async () => {
      try {
        const result = await sendMissionToTelegram(
          missione.mezzo,
          missione,
          evento,
          manifestationId,
        );
        if (result.ok) {
          setSendStatus('ok');
          storeStatus(manifestationId, missionDocId, 'ok');
        } else {
          setSendStatus('err');
          storeStatus(manifestationId, missionDocId, 'err');
        }
      } catch (err) {
        console.error(err);
        setSendStatus('err');
        storeStatus(manifestationId, missionDocId, 'err');
      } finally {
        inFlightRef.current = false;
      }
    })();
  }, [telegramEnabled, manifestationId, missionDocId, missione, evento]);

  const handleClick = (e) => {
    e.stopPropagation();
    runSend();
  };

  return (
    <span
      className={`inline-flex items-center gap-1 ${className}`}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {sendStatus === 'ok' && (
        <Check
          className="h-4 w-4 shrink-0 text-emerald-600"
          aria-label="Invio Telegram riuscito"
          title="Inviato"
        />
      )}
      {sendStatus === 'err' && (
        <X
          className="h-4 w-4 shrink-0 text-red-600"
          aria-label="Invio Telegram fallito"
          title="Invio fallito — clic per riprovare"
        />
      )}
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        title={
          telegramEnabled
            ? 'Invia su Telegram (in background)'
            : 'Bot Telegram disattivato'
        }
        aria-label="Invia su Telegram"
        className="inline-flex items-center gap-1 rounded border border-sky-300 bg-sky-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-sky-800 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Send className="h-3 w-3 shrink-0" aria-hidden />
        <span>Invia su Telegram</span>
      </button>
    </span>
  );
}
