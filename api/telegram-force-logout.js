import { getAdminAuth } from './_lib/firebaseAdmin.js';
import { getTelegramTenantId } from './_lib/env.js';
import { invalidateAllTelegramAuth } from './_lib/telegramFirestore.js';

async function verifyFirebaseUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw Object.assign(new Error('Token di autenticazione mancante'), { status: 401 });
  }
  return getAdminAuth().verifyIdToken(authHeader.slice(7));
}

/** Fine evento: disconnette tutti gli equipaggi Telegram (senza cancellare messaggi). */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await verifyFirebaseUser(req);
    const tenantId = getTelegramTenantId();
    const invalidated = await invalidateAllTelegramAuth(tenantId);
    return res.status(200).json({ ok: true, invalidated });
  } catch (err) {
    const status = err.status ?? 500;
    if (status >= 500) console.error('[telegram-force-logout]', err);
    return res.status(status).json({ error: err.message ?? 'Internal error' });
  }
}
