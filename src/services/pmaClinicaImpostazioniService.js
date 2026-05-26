import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { impostazioniDocRef } from './impostazioniService';
import {
  parseFarmaciConsumatiFromFirestore,
  serializeFarmaciConsumati,
} from '../pma/types/farmaciConsumatiStats';

/** Aggiorna solo `pmaClinica.farmaci_consumati` (statistiche utilizzo). */
export async function savePmaClinicaFarmaciConsumati(manifestationId, consumatiSerialized) {
  const tenant = String(manifestationId ?? '').trim();
  if (!tenant) return;
  const docRef = impostazioniDocRef(tenant);
  const snap = await getDoc(docRef);
  const payload = { 'pmaClinica.farmaci_consumati': consumatiSerialized ?? [] };
  if (!snap.exists()) {
    await setDoc(
      docRef,
      { manifestationId: tenant, pmaClinica: { farmaci_consumati: consumatiSerialized ?? [] } },
      { merge: true },
    );
    return;
  }
  await updateDoc(docRef, payload);
}

/** Azzera statistiche consumati su Firestore. */
export async function clearPmaClinicaFarmaciConsumati(manifestationId) {
  return savePmaClinicaFarmaciConsumati(manifestationId, []);
}

/** Legge statistiche consumati dal documento impostazioni. */
export async function loadPmaClinicaFarmaciConsumati(manifestationId) {
  const tenant = String(manifestationId ?? '').trim();
  if (!tenant) return [];
  const snap = await getDoc(impostazioniDocRef(tenant));
  const raw = snap.data()?.pmaClinica?.farmaci_consumati;
  return serializeFarmaciConsumati(parseFarmaciConsumatiFromFirestore(raw));
}
