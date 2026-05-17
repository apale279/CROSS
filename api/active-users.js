import { getAdminAuth } from './_lib/firebaseAdmin.js';
import { listActiveWebUsers } from './_lib/activeWebUsers.js';
import { requireTenant } from './_lib/resolveTenant.js';

async function verifyFirebaseUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw Object.assign(new Error('Token di autenticazione mancante'), { status: 401 });
  }
  return getAdminAuth().verifyIdToken(authHeader.slice(7));
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await verifyFirebaseUser(req);
    const tenantId = requireTenant(req);
    const users = await listActiveWebUsers(tenantId);

    return res.status(200).json({
      ok: true,
      total: users.length,
      users,
    });
  } catch (err) {
    const status = err.status ?? 500;
    if (status >= 500) console.error('[active-users]', err);
    return res.status(status).json({ error: err.message ?? 'Internal error' });
  }
}
