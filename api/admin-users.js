import { getAdminAuth, getAdminDb } from './_lib/firebaseAdmin.js';
import { createAuthUserWithEmailReclaim, deleteAuthUserCompletely } from './_lib/adminUserLifecycle.js';
import { requireTenant } from './_lib/resolveTenant.js';
import { verifyFirebaseUser } from './_lib/verifyFirebaseUser.js';
import { requireWebAdmin } from './_lib/requireWebAdmin.js';

function profileRef(tenantId, uid) {
  return getAdminDb().doc(`manifestazioni/${tenantId}/userProfiles/${uid}`);
}

function normalizeBody(body) {
  const accessType = String(body.accessType ?? 'CENTRALE').trim().toUpperCase();
  const pmaRank = String(body.pmaRank ?? '').trim().toUpperCase();
  const pmaScopeId = String(body.pmaScopeId ?? '').trim();
  return {
    email: String(body.email ?? '').trim().toLowerCase(),
    password: String(body.password ?? ''),
    nome: String(body.nome ?? '').trim(),
    nomeUtente: String(body.nomeUtente ?? '').trim(),
    accessType: accessType === 'PMA' ? 'PMA' : 'CENTRALE',
    pmaRank: accessType === 'PMA' ? pmaRank : '',
    pmaScopeId: accessType === 'PMA' ? pmaScopeId : '',
  };
}

async function listUsers(tenantId) {
  const snap = await getAdminDb().collection(`manifestazioni/${tenantId}/userProfiles`).get();
  const auth = getAdminAuth();
  const rows = [];

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    let email = data.email ?? '';
    try {
      const au = await auth.getUser(docSnap.id);
      email = au.email ?? email;
    } catch {
      /* profilo senza account Auth (uid orfano) */
    }
    rows.push({
      uid: docSnap.id,
      email,
      nome: data.nome ?? '',
      nomeUtente: data.nomeUtente ?? '',
      accessType: data.accessType ?? (data.pmaScopeId ? 'PMA' : 'CENTRALE'),
      pmaRank: data.pmaRank ?? '',
      pmaScopeId: data.pmaScopeId ?? '',
    });
  }

  rows.sort((a, b) => (a.nome || a.email).localeCompare(b.nome || b.email, 'it'));
  return rows;
}

export default async function handler(req, res) {
  try {
    const decoded = await verifyFirebaseUser(req);
    const tenantId = requireTenant(req);
    await requireWebAdmin(decoded, tenantId);

    if (req.method === 'GET') {
      const users = await listUsers(tenantId);
      return res.status(200).json({ ok: true, users });
    }

    if (req.method === 'POST') {
      const b = normalizeBody(req.body ?? {});
      if (!b.email || !b.password || b.password.length < 6) {
        return res.status(400).json({ error: 'Email e password (min 6 caratteri) obbligatori.' });
      }
      if (b.accessType === 'PMA' && !b.pmaScopeId) {
        return res.status(400).json({ error: 'Seleziona un PMA per utenti PMA.' });
      }

      const userRecord = await createAuthUserWithEmailReclaim({
        email: b.email,
        password: b.password,
        displayName: b.nome || b.nomeUtente || undefined,
        hasProfileInTenant: async (uid) => {
          const prof = await profileRef(tenantId, uid).get();
          return prof.exists;
        },
      });

      await profileRef(tenantId, userRecord.uid).set({
        email: b.email,
        nome: b.nome,
        nomeUtente: b.nomeUtente,
        accessType: b.accessType,
        pmaRank: b.pmaRank,
        pmaScopeId: b.pmaScopeId,
        creatoIl: new Date(),
      });

      return res.status(201).json({ ok: true, uid: userRecord.uid });
    }

    if (req.method === 'PATCH') {
      const uid = String(req.body?.uid ?? '').trim();
      if (!uid) return res.status(400).json({ error: 'uid obbligatorio' });

      const b = normalizeBody(req.body ?? {});
      if (b.accessType === 'PMA' && !b.pmaScopeId) {
        return res.status(400).json({ error: 'Seleziona un PMA per utenti PMA.' });
      }

      const auth = getAdminAuth();
      const authUpdate = {};
      if (b.email) authUpdate.email = b.email;
      if (b.password && b.password.length >= 6) authUpdate.password = b.password;
      if (b.nome || b.nomeUtente) {
        authUpdate.displayName = b.nome || b.nomeUtente;
      }
      if (Object.keys(authUpdate).length > 0) {
        try {
          await auth.updateUser(uid, authUpdate);
        } catch (err) {
          if (err.code === 'auth/email-already-exists') {
            return res.status(409).json({
              error: 'Email già usata da un altro account Firebase.',
            });
          }
          throw err;
        }
      }

      const profilePatch = {
        nome: b.nome,
        nomeUtente: b.nomeUtente,
        accessType: b.accessType,
        pmaRank: b.pmaRank,
        pmaScopeId: b.pmaScopeId,
        aggiornatoIl: new Date(),
      };
      if (b.email) profilePatch.email = b.email;

      await profileRef(tenantId, uid).set(profilePatch, { merge: true });

      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const uid = String(req.query?.uid ?? req.body?.uid ?? '').trim();
      if (!uid) return res.status(400).json({ error: 'uid obbligatorio' });
      if (uid === decoded.uid) {
        return res.status(400).json({ error: 'Non puoi eliminare il tuo account.' });
      }

      await deleteAuthUserCompletely(uid);
      try {
        await profileRef(tenantId, uid).delete();
      } catch (err) {
        console.warn('[admin-users] delete profile', uid, err.message);
      }

      return res.status(200).json({ ok: true, authDeleted: true });
    }

    res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    const status = err.status ?? 500;
    if (status >= 500) console.error('[admin-users]', err);
    return res.status(status).json({ error: err.message ?? 'Internal error' });
  }
}
