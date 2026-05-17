import { auth } from '../firebaseConfig';
import { buildMissionTelegramPayload } from '../lib/telegramMissionPayload';

async function authHeaders() {
  const user = auth.currentUser;
  if (!user) throw new Error('Devi essere autenticato');
  const idToken = await user.getIdToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${idToken}`,
  };
}

/**
 * Invia missione in background (non blocca la UI).
 * @returns {Promise<{ ok: boolean, sent?: number, error?: string }>}
 */
export async function sendMissionToTelegram(mezzoId, missione, evento = null) {
  const mezzo = (mezzoId ?? missione?.mezzo ?? '').trim();
  if (!mezzo) throw new Error('Mezzo non specificato');

  const missionePayload = buildMissionTelegramPayload(missione, evento);
  const headers = await authHeaders();

  const res = await fetch('/api/telegram-send', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      mezzo,
      mezzo_id: mezzo,
      missione: missionePayload,
      missione_data: missionePayload,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: data.error ?? `Invio fallito (${res.status})` };
  }
  const sent = data.sent ?? 0;
  if (sent === 0) {
    return { ok: false, error: 'Nessun destinatario Telegram per questo mezzo' };
  }
  return { ok: true, sent, total: data.total };
}

/** Dopo cambio stato dalla centrale: nuovo messaggio Telegram con pulsante corretto. */
export function notifyTelegramStatoFromCentrale(missionDocId) {
  const id = (missionDocId ?? '').trim();
  if (!id) return;

  void (async () => {
    try {
      const headers = await authHeaders();
      await fetch('/api/telegram-notify-stato', {
        method: 'POST',
        headers,
        body: JSON.stringify({ missionDocId: id }),
      });
    } catch (err) {
      console.warn('[telegram notify stato]', err);
    }
  })();
}

export async function setTelegramBotPassword(password, { notifyUsers = true } = {}) {
  const headers = await authHeaders();
  const res = await fetch('/api/telegram-set-password', {
    method: 'POST',
    headers,
    body: JSON.stringify({ password, notifyUsers }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Salvataggio password fallito');
  return data;
}
