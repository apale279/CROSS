import { getAdminAuth } from './_lib/firebaseAdmin.js';
import { clearAllMezziPosizioneReale } from './_lib/clearMezziPosizioneReale.js';
import { requireTenant } from './_lib/resolveTenant.js';

async function verifyFirebaseUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw Object.assign(new Error('Token di autenticazione mancante'), { status: 401 });
  }
  return getAdminAuth().verifyIdToken(authHeader.slice(7));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await verifyFirebaseUser(req);
    const body = req.body ?? {};
    const tenantId = requireTenant(req, body);
    const cleared = await clearAllMezziPosizioneReale(tenantId);
    return res.status(200).json({ ok: true, cleared });
  } catch (err) {
    const status = err.status ?? 500;
    if (status >= 500) console.error('[clear-mezzi-gps]', err);
    return res.status(status).json({ error: err.message ?? 'Internal error' });
  }
}
