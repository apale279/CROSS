import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from './firebaseAdmin.js';
import { resolveMezzoSiglaForTelegram } from './mezzoResolve.js';
import { isTelegramGpsTrackingEnabled } from './telegramFirestore.js';

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
  if (!(await isTelegramGpsTrackingEnabled(tenantId))) {
    throw new Error('Tracking GPS disattivato in Impostazioni → Telegram');
  }

  const s = await resolveMezzoSiglaForTelegram(tenantId, String(siglaRaw ?? '').trim());
  if (!s || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error('Sigla o coordinate non valide');
  }

  const ref = mezzoRef(tenantId, s);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new Error(`Mezzo ${s} non trovato`);
  }

  const existing = snap.data()?.posizioneReale ?? {};
  const posizioneReale = {
    coordinate: { lat, lng },
    aggiornatoIl: FieldValue.serverTimestamp(),
    fonte: meta.fonte ?? 'telegram',
  };
  if (meta.precisione != null && Number.isFinite(meta.precisione)) {
    posizioneReale.precisione = meta.precisione;
  } else if (existing.precisione != null && Number.isFinite(Number(existing.precisione))) {
    posizioneReale.precisione = existing.precisione;
  }

  await ref.set({ posizioneReale }, { merge: true });
  return posizioneReale;
}
