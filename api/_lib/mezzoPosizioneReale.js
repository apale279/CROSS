import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from './firebaseAdmin.js';
import { resolveMezzoSiglaForTelegram } from './mezzoResolve.js';

function mezzoRef(tenantId, sigla) {
  return getAdminDb()
    .collection('manifestazioni')
    .doc(tenantId)
    .collection('mezzi')
    .doc(sigla);
}

/**
 * Aggiorna posizione GPS reale del mezzo (da Telegram o altre fonti).
 * @param {object} [meta]
 * @param {number} [meta.precisione]
 * @param {string} [meta.fonte]
 */
export async function updateMezzoPosizioneReale(tenantId, siglaRaw, lat, lng, meta = {}) {
  const s = await resolveMezzoSiglaForTelegram(tenantId, String(siglaRaw ?? '').trim());
  if (!s || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error('Sigla o coordinate non valide');
  }

  const ref = mezzoRef(tenantId, s);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new Error(`Mezzo ${s} non trovato`);
  }

  const payload = {
    posizioneReale: {
      coordinate: { lat, lng },
      aggiornatoIl: FieldValue.serverTimestamp(),
      fonte: meta.fonte ?? 'telegram',
    },
  };
  if (meta.precisione != null && Number.isFinite(meta.precisione)) {
    payload.posizioneReale.precisione = meta.precisione;
  }

  await ref.set(payload, { merge: true });
  return payload.posizioneReale;
}
