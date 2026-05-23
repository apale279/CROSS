import { auth } from '../firebaseConfig';
import { apiUrl } from '../lib/apiUrl';
import { tenantApiBody } from '../lib/tenantApiBody';

async function authHeaders() {
  const user = auth.currentUser;
  if (!user) return null;
  const idToken = await user.getIdToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${idToken}`,
  };
}

/**
 * Dopo DIRETTO H sulla missione: allinea invio PS su PMApp (stesso Firebase).
 * Fire-and-forget come notify Telegram.
 */
export function notifyPmappDirettoHFromCentrale(manifestationId, missionDocId) {
  const id = (missionDocId ?? '').trim();
  if (!id) return;

  void (async () => {
    try {
      const headers = await authHeaders();
      if (!headers) return;
      await fetch(apiUrl('/api/pmapp-sync-diretto-h'), {
        method: 'POST',
        headers,
        body: JSON.stringify(tenantApiBody(manifestationId, { missionDocId: id })),
      });
    } catch (err) {
      console.warn('[pmapp sync diretto H]', err);
    }
  })();
}
