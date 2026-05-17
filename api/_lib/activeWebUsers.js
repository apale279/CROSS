import { getFirestore } from 'firebase-admin/firestore';
import { getAdminAuth } from './firebaseAdmin.js';

function toIso(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return null;
}

/** Profili con sessione web valida (active_session_token impostato). */
export async function listActiveWebUsers(tenantId) {
  const db = getFirestore();
  const snap = await db.collection(`manifestazioni/${tenantId}/userProfiles`).get();
  const auth = getAdminAuth();

  const rows = [];
  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const token = String(data.active_session_token ?? '').trim();
    if (!token) continue;

    let email = null;
    try {
      const record = await auth.getUser(docSnap.id);
      email = record.email ?? null;
    } catch {
      email = null;
    }

    rows.push({
      uid: docSnap.id,
      nome: String(data.nome ?? '').trim(),
      nomeUtente: String(data.nomeUtente ?? '').trim(),
      email,
      sessionUpdatedAt: toIso(data.sessionUpdatedAt),
      lastSeenAt: toIso(data.lastSeenAt),
      lastPath: String(data.lastPath ?? '').trim() || null,
      lastActivityType: String(data.lastActivityType ?? '').trim() || null,
    });
  }

  rows.sort((a, b) => {
    const ta = a.lastSeenAt ?? a.sessionUpdatedAt ?? '';
    const tb = b.lastSeenAt ?? b.sessionUpdatedAt ?? '';
    return tb.localeCompare(ta);
  });

  return rows;
}
