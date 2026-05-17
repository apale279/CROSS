import { auth } from '../firebaseConfig';
import { apiUrl } from '../lib/apiUrl';

async function authHeaders() {
  const user = auth.currentUser;
  if (!user) throw new Error('Devi essere autenticato');
  const idToken = await user.getIdToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${idToken}`,
  };
}

/** Solo bot Telegram: cancella messaggi missione e svuota sessioni equipaggio (non disconnette l'app web). */
export async function executeTelegramBotWipeOnly() {
  const headers = await authHeaders();
  const res = await fetch(apiUrl('/api/telegram-wipe'), {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error ?? `Pulizia Telegram fallita (${res.status})`);
  }
  return data;
}

/** Fine evento: logout forzato di tutti gli utenti Telegram (mantiene i messaggi). */
export async function forceTelegramBotLogout() {
  const headers = await authHeaders();
  const res = await fetch(apiUrl('/api/telegram-force-logout'), {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error ?? `Logout bot fallito (${res.status})`);
  }
  return data;
}
