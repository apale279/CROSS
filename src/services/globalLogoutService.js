import { auth } from '../firebaseConfig';
import {
  clearAllMezziSessionTokens,
  clearAllUserSessionTokens,
} from './deviceSessionService';

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
 * Logout globale: azzera sessioni mezzi + profili, poi wipe messaggi Telegram.
 */
export async function executeGlobalLogoutAndTelegramWipe(manifestationId) {
  const mezziCleared = await clearAllMezziSessionTokens(manifestationId);
  const usersCleared = await clearAllUserSessionTokens(manifestationId);

  const headers = await authHeaders();
  const res = await fetch('/api/telegram-wipe', {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      data.error ??
        `Pulizia Telegram fallita (${res.status}). Sessioni già azzerate su Firestore.`,
    );
  }

  return {
    mezziCleared,
    usersCleared,
    telegram: data,
  };
}
