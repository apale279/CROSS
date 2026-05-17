import { getAdminDb } from './firebaseAdmin.js';

/**
 * Allinea la sigla missione a quella canonica in Firestore (doc mezzi).
 * Gestisce mismatch storici es. BRAVO1 vs BRAVO_1 (ignora underscore per il match).
 */
export async function resolveMezzoSiglaForTelegram(tenantId, mezzoRaw) {
  const key = String(mezzoRaw ?? '').trim();
  if (!key) return '';

  const snap = await getAdminDb()
    .collection('manifestazioni')
    .doc(tenantId)
    .collection('mezzi')
    .get();

  const entries = snap.docs.map((d) => {
    const data = d.data();
    const sigla = String(data.sigla ?? d.id ?? '').trim();
    return { docId: d.id, sigla };
  });

  const exact = entries.find((e) => e.sigla === key || e.docId === key);
  if (exact) return exact.sigla;

  const norm = (s) => s.replace(/_/g, '').toLowerCase();
  const nk = norm(key);
  const fuzzy = entries.filter((e) => norm(e.sigla) === nk || norm(e.docId) === nk);
  if (fuzzy.length === 1) return fuzzy[0].sigla;

  return key;
}
