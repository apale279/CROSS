import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  writeBatch,
  deleteField,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { registryPartecipantiPathSegments } from '../lib/firestorePaths';
import { impostazioniDocRef } from './impostazioniService';

function registryColRef(manifestationId) {
  return collection(db, ...registryPartecipantiPathSegments(manifestationId));
}

function bibDocId(pettorale) {
  const n =
    typeof pettorale === 'number' && Number.isFinite(pettorale)
      ? Math.trunc(pettorale)
      : parseInt(String(pettorale ?? '').trim(), 10);
  if (!Number.isFinite(n) || n < 1) throw new Error('Pettorale non valido per il registry');
  return String(n);
}

async function runBatchedDeletes(refs) {
  let batch = writeBatch(db);
  let ops = 0;
  const flush = async () => {
    if (ops === 0) return;
    await batch.commit();
    batch = writeBatch(db);
    ops = 0;
  };
  for (const r of refs) {
    batch.delete(r);
    ops += 1;
    if (ops >= 450) await flush();
  }
  await flush();
}

async function runBatchedSets(entries) {
  let batch = writeBatch(db);
  let ops = 0;
  const flush = async () => {
    if (ops === 0) return;
    await batch.commit();
    batch = writeBatch(db);
    ops = 0;
  };
  for (const [ref, data] of entries) {
    batch.set(ref, data, { merge: false });
    ops += 1;
    if (ops >= 450) await flush();
  }
  await flush();
}

/** Elimina solo i documenti del registry (campo legacy sul doc Impostazioni resta eventualmente alla clear successiva). */
export async function clearRegistryPartecipanti(manifestationId) {
  const col = registryColRef(manifestationId);
  const snap = await getDocs(col);
  const refs = snap.docs.map((d) => d.ref);
  await runBatchedDeletes(refs);
  await dropLegacyRegistryFieldIfPresent(manifestationId);
}

/**
 * Sostituisce tutto il registry subendo upload concorrenti per-bib (ultimo set su stesso pettorale vince).
 * Due upload quasi simultanei: l’ordine delle due “replace” definisce chi vince il merge globale ma le righe
 * sono comunque più piccole degli array monolitici su `impostazioni`.
 */
export async function replaceRegistryPartecipanti(manifestationId, rows) {
  const col = registryColRef(manifestationId);
  const snap = await getDocs(col);
  await runBatchedDeletes(snap.docs.map((d) => d.ref));

  const pairs = [];
  for (const r of rows ?? []) {
    const pettorale =
      typeof r.pettorale === 'number'
        ? Math.trunc(r.pettorale)
        : parseInt(String(r?.pettorale ?? '').trim(), 10);
    if (!Number.isFinite(pettorale) || pettorale < 1) continue;
    const ref = doc(col, bibDocId(pettorale));
    pairs.push([
      ref,
      {
        pettorale,
        nome: r.nome ?? '',
        cognome: r.cognome ?? '',
        dataNascita: r.dataNascita ?? '',
        telefono: r.telefono ?? '',
      },
    ]);
  }

  await runBatchedSets(pairs);
  await dropLegacyRegistryFieldIfPresent(manifestationId);
}

async function dropLegacyRegistryFieldIfPresent(manifestationId) {
  const impRef = impostazioniDocRef(manifestationId);
  const s = await getDoc(impRef);
  if (s.exists() && s.data()?.registryPartecipanti !== undefined) {
    await updateDoc(impRef, { registryPartecipanti: deleteField() });
  }
}

/** Migrazione unica campo array sul doc Impostazioni → sottocollezione. */
export async function migrateLegacyRegistryFromImpostazioniDoc(manifestationId, legacyArray) {
  if (!Array.isArray(legacyArray) || legacyArray.length === 0) return;
  const col = registryColRef(manifestationId);
  const snap = await getDocs(col);
  if (!snap.empty) {
    await dropLegacyRegistryFieldIfPresent(manifestationId);
    return;
  }
  await replaceRegistryPartecipanti(manifestationId, legacyArray);
}
