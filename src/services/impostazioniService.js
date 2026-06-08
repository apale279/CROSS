import { deleteField, doc, FieldPath, getDoc, runTransaction, setDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { assertCanEditImpostazioniConfig } from '../lib/impostazioniEditGate';
import { impostazioniValuesMatch } from '../lib/impostazioniEqual';
import {
  isImpostazioniFieldSaveBlocked,
  isImpostazioniNestedObjectField,
  isImpostazioniTransactionalArrayField,
} from '../lib/impostazioniFieldAccess';
import { impostazioniPath } from '../lib/firestorePaths';

export function impostazioniDocRef(manifestationId) {
  return doc(db, ...impostazioniPath(manifestationId));
}

/** Crea solo il documento vuoto (solo manifestationId), senza sovrascrivere campi esistenti. */
export async function ensureImpostazioniDocument(manifestationId) {
  const docRef = impostazioniDocRef(manifestationId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    await setDoc(docRef, { manifestationId }, { merge: true });
  }
}

function assertGranularField(fieldKey) {
  if (isImpostazioniNestedObjectField(fieldKey)) {
    throw new Error(
      `Salvataggio intero di «${fieldKey}» non consentito: usare update puntati (es. saveDettaglioTipoLuogo / savePmaClinicaDotFields).`,
    );
  }
  if (isImpostazioniTransactionalArrayField(fieldKey)) {
    throw new Error(
      `Salvataggio intero di «${fieldKey}» non consentito: usare saveImpostazioniArrayEntryById / deleteImpostazioniArrayEntryById.`,
    );
  }
}

function readArrayFieldRaw(data, fieldKey) {
  const raw = data?.[fieldKey];
  return Array.isArray(raw) ? [...raw] : [];
}

function readImpostazioniDotPathValue(data, dotPath) {
  if (!data || !dotPath) return undefined;
  return String(dotPath)
    .split('.')
    .reduce((acc, part) => (acc == null ? undefined : acc[part]), data);
}

function impostazioniWriteNeeded(current, next) {
  if (next === deleteField()) return current !== undefined;
  return !impostazioniValuesMatch(current, next);
}

/** Aggiunge/rimuove voci in array scalare (tipiLuogo, tipiEvento) partendo dallo snapshot server. */
export async function appendImpostazioniScalarArrayItem(manifestationId, fieldKey, item) {
  assertCanEditImpostazioniConfig();
  assertGranularField(fieldKey);
  const value = String(item ?? '').trim();
  if (!value) return;

  const docRef = impostazioniDocRef(manifestationId);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(docRef);
    const current = readArrayFieldRaw(snap.exists() ? snap.data() : null, fieldKey);
    if (current.some((x) => String(x).toLowerCase() === value.toLowerCase())) return;
    if (!snap.exists()) {
      transaction.set(docRef, { manifestationId, [fieldKey]: [...current, value] }, { merge: true });
      return;
    }
    transaction.update(docRef, { [fieldKey]: [...current, value] });
  });
}

export async function removeImpostazioniScalarArrayItem(manifestationId, fieldKey, item) {
  assertCanEditImpostazioniConfig();
  assertGranularField(fieldKey);
  const needle = String(item ?? '').trim();
  if (!needle) return;

  const docRef = impostazioniDocRef(manifestationId);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(docRef);
    if (!snap.exists()) return;
    const current = readArrayFieldRaw(snap.data(), fieldKey);
    const next = current.filter((x) => String(x) !== needle);
    if (next.length === current.length) return;
    transaction.update(docRef, { [fieldKey]: next });
  });
}

/** Upsert di una voce in array di oggetti con `id` (stazionamenti, pma). */
export async function saveImpostazioniArrayEntryById(manifestationId, arrayField, entry) {
  assertCanEditImpostazioniConfig();
  if (!isImpostazioniTransactionalArrayField(arrayField)) {
    throw new Error(`saveImpostazioniArrayEntryById: campo «${arrayField}» non supportato.`);
  }
  const id = String(entry?.id ?? '').trim();
  if (!id) throw new Error('Voce impostazioni senza id.');

  const docRef = impostazioniDocRef(manifestationId);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(docRef);
    const current = readArrayFieldRaw(snap.exists() ? snap.data() : null, arrayField);
    const idx = current.findIndex((x) => String(x?.id ?? '') === id);
    const merged = idx >= 0 ? { ...current[idx], ...entry, id } : { ...entry, id };
    if (idx >= 0 && impostazioniValuesMatch(current[idx], merged)) return;

    const next = [...current];
    if (idx >= 0) next[idx] = merged;
    else next.push(merged);

    if (!snap.exists()) {
      transaction.set(docRef, { manifestationId, [arrayField]: next }, { merge: true });
      return;
    }
    transaction.update(docRef, { [arrayField]: next });
  });
}

/**
 * Aggiorna solo le etichette posti letto di un PMA (operazione desk, senza gate impostazioni).
 */
export async function patchPmaPostiLettoLabels(manifestationId, pmaId, postiLettoLabels) {
  const id = String(pmaId ?? '').trim();
  if (!id) throw new Error('PMA senza id.');

  const docRef = impostazioniDocRef(manifestationId);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(docRef);
    const current = readArrayFieldRaw(snap.exists() ? snap.data() : null, 'pma');
    const idx = current.findIndex((x) => String(x?.id ?? '') === id);
    if (idx < 0) throw new Error('PMA non trovato.');

    const merged = { ...current[idx], id, postiLettoLabels: postiLettoLabels ?? {} };
    if (impostazioniValuesMatch(current[idx], merged)) return;

    const next = [...current];
    next[idx] = merged;

    if (!snap.exists()) {
      transaction.set(docRef, { manifestationId, pma: next }, { merge: true });
      return;
    }
    transaction.update(docRef, { pma: next });
  });
}

export async function deleteImpostazioniArrayEntryById(manifestationId, arrayField, entryId) {
  assertCanEditImpostazioniConfig();
  if (!isImpostazioniTransactionalArrayField(arrayField)) {
    throw new Error(`deleteImpostazioniArrayEntryById: campo «${arrayField}» non supportato.`);
  }
  const id = String(entryId ?? '').trim();
  if (!id) return;

  const docRef = impostazioniDocRef(manifestationId);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(docRef);
    if (!snap.exists()) return;
    const current = readArrayFieldRaw(snap.data(), arrayField);
    const next = current.filter((x) => String(x?.id ?? '') !== id);
    if (next.length === current.length) return;
    transaction.update(docRef, { [arrayField]: next });
  });
}

/** Sostituzione esplicita di un intero array (solo import bulk confermato dall'operatore). */
export async function replaceImpostazioniArrayField(manifestationId, arrayField, nextArray) {
  assertCanEditImpostazioniConfig();
  if (!isImpostazioniTransactionalArrayField(arrayField)) {
    throw new Error(`replaceImpostazioniArrayField: campo «${arrayField}» non supportato.`);
  }
  await saveImpostazioniDotPath(manifestationId, arrayField, Array.isArray(nextArray) ? nextArray : []);
}

/**
 * Aggiorna una voce in mappa annidata con FieldPath (supporta «/» nel nome tipo).
 */
export async function saveImpostazioniMapEntry(manifestationId, parentField, entryKey, value) {
  assertCanEditImpostazioniConfig();
  const key = String(entryKey ?? '').trim();
  if (!key) return;

  const docRef = impostazioniDocRef(manifestationId);
  const fieldPath = new FieldPath(parentField, key);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(docRef);
    const current = snap.exists() ? snap.get(fieldPath) : undefined;
    if (!impostazioniWriteNeeded(current, value)) return;

    if (!snap.exists()) {
      transaction.set(
        docRef,
        { manifestationId, [parentField]: { [key]: value } },
        { merge: true },
      );
      return;
    }
    transaction.update(docRef, fieldPath, value);
  });
}

/** Elimina una voce in mappa annidata. */
export async function deleteImpostazioniMapEntry(manifestationId, parentField, entryKey) {
  return saveImpostazioniMapEntry(manifestationId, parentField, entryKey, deleteField());
}

/**
 * Aggiorna un solo path top-level o `pmaClinica.sottochiave`.
 */
export async function saveImpostazioniDotPath(manifestationId, dotPath, value) {
  assertCanEditImpostazioniConfig();
  const path = String(dotPath ?? '').trim();
  if (!path) return;

  const docRef = impostazioniDocRef(manifestationId);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(docRef);
    const current = snap.exists() ? readImpostazioniDotPathValue(snap.data(), path) : undefined;
    if (!impostazioniWriteNeeded(current, value)) return;

    if (!snap.exists()) {
      transaction.set(docRef, { manifestationId, [path]: value }, { merge: true });
      return;
    }
    transaction.update(docRef, { [path]: value });
  });
}

/**
 * Salva un solo campo top-level scalare/array (mai mappe annidate intere).
 */
export async function saveImpostazioniField(manifestationId, fieldKey, value) {
  assertCanEditImpostazioniConfig();
  if (fieldKey == null || fieldKey === '') return;
  assertGranularField(fieldKey);
  await saveImpostazioniDotPath(manifestationId, fieldKey, value);
}

/** Aggiorna solo `pmaClinica.{sottochiave}` — non tocca altre sottochiavi sul server. */
export async function savePmaClinicaDotFields(manifestationId, subfields) {
  assertCanEditImpostazioniConfig();
  const entries = Object.entries(subfields ?? {}).filter(([k]) => k);
  if (entries.length === 0) return;

  const docRef = impostazioniDocRef(manifestationId);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(docRef);
    const data = snap.exists() ? snap.data() : null;
    const changedEntries = entries.filter(([key, value]) =>
      impostazioniWriteNeeded(readImpostazioniDotPathValue(data, `pmaClinica.${key}`), value),
    );
    if (changedEntries.length === 0) return;

    const changedUpdates = Object.fromEntries(
      changedEntries.map(([key, value]) => [`pmaClinica.${key}`, value]),
    );

    if (!snap.exists()) {
      transaction.set(
        docRef,
        {
          manifestationId,
          pmaClinica: Object.fromEntries(changedEntries),
        },
        { merge: true },
      );
      return;
    }
    transaction.update(docRef, changedUpdates);
  });
}

/** Aggiorna solo una voce di dettagliPerTipoEvento. */
export async function saveDettaglioTipoEvento(manifestationId, tipo, list) {
  if (!tipo) return;
  await saveImpostazioniMapEntry(manifestationId, 'dettagliPerTipoEvento', tipo, list);
}

/** Aggiorna solo una voce di dettagliPerTipoLuogo. */
export async function saveDettaglioTipoLuogo(manifestationId, tipo, list) {
  if (!tipo) return;
  await saveImpostazioniMapEntry(manifestationId, 'dettagliPerTipoLuogo', tipo, list);
}

/** @deprecated usa saveImpostazioniField / saveImpostazioniDotPath / saveImpostazioniMapEntry */
export async function updateImpostazioniDocument(manifestationId, partialFields) {
  assertCanEditImpostazioniConfig();
  const entries = Object.entries(partialFields ?? {});
  if (entries.length === 0) return;

  for (const [key, value] of entries) {
    if (key.includes('.')) {
      const [parent, ...rest] = key.split('.');
      const mapKey = rest.join('.');
      if (rest.length > 0 && isImpostazioniNestedObjectField(parent)) {
        await saveImpostazioniMapEntry(manifestationId, parent, mapKey, value);
        continue;
      }
      await saveImpostazioniDotPath(manifestationId, key, value);
      continue;
    }
    if (isImpostazioniFieldSaveBlocked(key)) {
      throw new Error(`updateImpostazioniDocument: campo «${key}» richiede API puntate.`);
    }
    await saveImpostazioniField(manifestationId, key, value);
  }
}

export async function patchImpostazioni(manifestationId, fields) {
  return updateImpostazioniDocument(manifestationId, fields);
}

/** Solo per nuova manifestazione: documento iniziale completo. */
export async function createImpostazioniDocument(manifestationId, initialData) {
  const docRef = impostazioniDocRef(manifestationId);
  await setDoc(docRef, { manifestationId, ...initialData }, { merge: true });
}
