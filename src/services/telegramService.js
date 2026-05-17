import { auth } from '../firebaseConfig';
import { apiUrl } from '../lib/apiUrl';
import { tenantApiBody } from '../lib/tenantApiBody';
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

function apiUnavailableHint(status) {
  if (import.meta.env.DEV && (status === 404 || status === 0)) {
    return ' In locale imposta VITE_API_BASE_URL nel file .env.local (vedi .env.example).';
  }
  return '';
}

/**
 * Invia missione in background (non blocca la UI).
 * @returns {Promise<{ ok: boolean, sent?: number, error?: string }>}
 */
export async function sendMissionToTelegram(
  mezzoId,
  missione,
  evento = null,
  manifestationId,
) {
  const mezzo = (mezzoId ?? missione?.mezzo ?? '').trim();
  if (!mezzo) throw new Error('Mezzo non specificato');

  const missionePayload = buildMissionTelegramPayload(missione, evento);
  const headers = await authHeaders();

  const res = await fetch(apiUrl('/api/telegram-send'), {
    method: 'POST',
    headers,
    body: JSON.stringify(
      tenantApiBody(manifestationId, {
        mezzo,
        mezzo_id: mezzo,
        missione: missionePayload,
        missione_data: missionePayload,
      }),
    ),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      error: (data.error ?? `Invio fallito (${res.status})`) + apiUnavailableHint(res.status),
    };
  }
  const sent = data.sent ?? 0;
  if (sent === 0) {
    return {
      ok: false,
      error: data.error ?? 'Nessun destinatario Telegram per questo mezzo',
    };
  }
  return { ok: true, sent, total: data.total };
}

/** Dopo cambio stato dalla centrale: nuovo messaggio Telegram con pulsante corretto. */
export function notifyTelegramStatoFromCentrale(manifestationId, missionDocId) {
  const id = (missionDocId ?? '').trim();
  if (!id) return;

  void (async () => {
    try {
      const headers = await authHeaders();
      await fetch(apiUrl('/api/telegram-notify-stato'), {
        method: 'POST',
        headers,
        body: JSON.stringify(tenantApiBody(manifestationId, { missionDocId: id })),
      });
    } catch (err) {
      console.warn('[telegram notify stato]', err);
    }
  })();
}

export async function setTelegramBotPassword(
  password,
  { notifyUsers = true, manifestationId } = {},
) {
  const headers = await authHeaders();
  const res = await fetch(apiUrl('/api/telegram-set-password'), {
    method: 'POST',
    headers,
    body: JSON.stringify(
      tenantApiBody(manifestationId, { password, notifyUsers }),
    ),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data.error ?? 'Salvataggio password fallito') + apiUnavailableHint(res.status),
    );
  }
  return data;
}
