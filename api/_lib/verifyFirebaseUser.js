import { verifyFirebaseIdToken } from './firebaseIdToken.js';
import { getAdminAuth } from './firebaseAdmin.js';

/** @throws {Error & { status?: number }} */
export async function verifyFirebaseUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw Object.assign(new Error('Token di autenticazione mancante'), { status: 401 });
  }
  const token = authHeader.slice(7);
  try {
    return await verifyFirebaseIdToken(token);
  } catch (lightErr) {
    if (lightErr?.status === 401) throw lightErr;
  }
  try {
    return await getAdminAuth().verifyIdToken(token);
  } catch (adminErr) {
    const msg = adminErr instanceof Error ? adminErr.message : String(adminErr);
    if (/FIREBASE_SERVICE_ACCOUNT_JSON/i.test(msg)) {
      throw Object.assign(
        new Error(
          'Verifica accesso non disponibile: imposta VITE_FIREBASE_PROJECT_ID su Vercel oppure FIREBASE_SERVICE_ACCOUNT_JSON (consigliato base64 in FIREBASE_SERVICE_ACCOUNT_JSON_BASE64).',
        ),
        { status: 503 },
      );
    }
    throw Object.assign(new Error('Token di autenticazione non valido'), { status: 401 });
  }
}
