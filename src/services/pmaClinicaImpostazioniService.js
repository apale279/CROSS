import { doc, getDoc, runTransaction, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { impostazioniDocRef } from './impostazioniService';
import { mergeSchedaArrayById } from '../pma/lib/pmaSchedaArrayMerge';
import {
  incrementFarmacoConsumato,
  parseFarmaciConsumatiFromFirestore,
  serializeFarmaciConsumati,
} from '../pma/types/farmaciConsumatiStats';

/** Incremento atomico statistiche utilizzo (multi-operatore). */
export async function incrementPmaClinicaFarmacoConsumato(manifestationId, params) {
  const tenant = String(manifestationId ?? '').trim();
  const nome = String(params?.nome ?? '').trim();
  if (!tenant || !nome) return;

  const docRef = impostazioniDocRef(tenant);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(docRef);
    const pmaClinica = snap.exists() ? snap.data()?.pmaClinica ?? {} : {};
    const current = parseFarmaciConsumatiFromFirestore(pmaClinica.farmaci_consumati);
    const next = incrementFarmacoConsumato(current, params);
    const serialized = serializeFarmaciConsumati(next);

    if (!snap.exists()) {
      transaction.set(
        docRef,
        { manifestationId: tenant, pmaClinica: { farmaci_consumati: serialized } },
        { merge: true },
      );
      return;
    }
    transaction.update(docRef, { 'pmaClinica.farmaci_consumati': serialized });
  });
}

/** Aggiorna `pmaClinica.farmaci_consumati` (merge per id in transazione). */
export async function savePmaClinicaFarmaciConsumati(manifestationId, consumatiSerialized) {
  const tenant = String(manifestationId ?? '').trim();
  if (!tenant) return;
  const docRef = impostazioniDocRef(tenant);
  const clientRows = serializeFarmaciConsumati(
    parseFarmaciConsumatiFromFirestore(consumatiSerialized ?? []),
  );

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(docRef);
    if (!snap.exists()) {
      transaction.set(
        docRef,
        { manifestationId: tenant, pmaClinica: { farmaci_consumati: clientRows } },
        { merge: true },
      );
      return;
    }

    const serverRows = serializeFarmaciConsumati(
      parseFarmaciConsumatiFromFirestore(snap.data()?.pmaClinica?.farmaci_consumati),
    );
    const merged =
      clientRows.length === 0 ? [] : mergeSchedaArrayById(serverRows, clientRows);
    transaction.update(docRef, { 'pmaClinica.farmaci_consumati': merged });
  });
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
