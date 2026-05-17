import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from './firebaseAdmin.js';

/** Rimuove posizioneReale da tutti i mezzi del tenant (es. tracking GPS spento). */
export async function clearAllMezziPosizioneReale(tenantId) {
  const snap = await getAdminDb()
    .collection('manifestazioni')
    .doc(tenantId)
    .collection('mezzi')
    .get();

  if (snap.empty) return 0;

  const toClear = snap.docs.filter((d) => d.data()?.posizioneReale);
  if (!toClear.length) return 0;

  const BATCH = 450;
  for (let i = 0; i < toClear.length; i += BATCH) {
    const batch = getAdminDb().batch();
    for (const doc of toClear.slice(i, i + BATCH)) {
      batch.set(doc.ref, { posizioneReale: FieldValue.delete() }, { merge: true });
    }
    await batch.commit();
  }

  return toClear.length;
}
