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

/** Esegue effetti Telegram in background: errori solo in console, mai verso l'operatore. */
export function runTelegramSideEffect(label, fn) {
  void Promise.resolve()
    .then(fn)
    .catch((err) => {
      console.warn(`[telegram ${label}]`, err);
    });
}

async function postTelegramNotifyStato(manifestationId, missionDocId, extra = {}) {
  const id = (missionDocId ?? '').trim();
  if (!id) return;

  const headers = await authHeaders();
  const res = await fetch(apiUrl('/api/telegram-notify-stato'), {
    method: 'POST',
    headers,
    body: JSON.stringify(tenantApiBody(manifestationId, { missionDocId: id, ...extra })),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    console.warn('[telegram notify stato]', data.error ?? res.status);
  }
}

/** Dopo cambio stato dalla centrale: notifica + disattiva pulsanti su missioni chiuse. */
export function notifyTelegramStatoFromCentrale(manifestationId, missionDocId) {
  runTelegramSideEffect('notify stato', () => postTelegramNotifyStato(manifestationId, missionDocId));
}

/**
 * Prima di eliminare la missione: chiude l'interazione Telegram (pulsanti + avviso equipaggio).
 * Atteso in deleteMissione prima del deleteDoc (la missione deve esistere ancora su Firestore).
 */
export async function notifyTelegramMissioneEliminataFromCentrale(manifestationId, missionDocId) {
  try {
    await postTelegramNotifyStato(manifestationId, missionDocId, { eliminata: true });
  } catch (err) {
    console.warn('[telegram eliminata]', err);
  }
}

export async function fetchTelegramLoggedUsers(manifestationId) {
  const headers = await authHeaders();
  const id = (manifestationId ?? '').trim();
  const q = id ? `?manifestationId=${encodeURIComponent(id)}&tenantId=${encodeURIComponent(id)}` : '';
  const res = await fetch(apiUrl(`/api/telegram-logged-users${q}`), {
    method: 'GET',
    headers,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data.error ?? `Caricamento equipaggio fallito (${res.status})`) + apiUnavailableHint(res.status),
    );
  }
  return data;
}

export async function clearAllMezziPosizioneReale(manifestationId) {
  const headers = await authHeaders();
  const res = await fetch(apiUrl('/api/clear-mezzi-gps'), {
    method: 'POST',
    headers,
    body: JSON.stringify(tenantApiBody(manifestationId, {})),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data.error ?? `Pulizia GPS fallita (${res.status})`) + apiUnavailableHint(res.status),
    );
  }
  return data.cleared ?? 0;
}

export async function broadcastNotaToTelegram({ titolo, testo, manifestationId }) {
  const headers = await authHeaders();
  const res = await fetch(apiUrl('/api/telegram-broadcast-nota'), {
    method: 'POST',
    headers,
    body: JSON.stringify(tenantApiBody(manifestationId, { titolo, testo })),
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
      sent: 0,
      total: data.total ?? 0,
      error: data.error ?? 'Nessun equipaggio loggato sul bot',
    };
  }
  return { ok: true, sent, total: data.total ?? sent };
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
