import {
  deleteField,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../cross/firebase';
import { pmaFieldLocksRef, PMA_FIELD_LOCK_STALE_MS } from '../lib/pmaFieldPresencePaths';

function lockRef(manifestationId, pazienteDocId) {
  return doc(db, ...pmaFieldLocksRef(manifestationId, pazienteDocId));
}

function isStale(lock) {
  if (!lock?.updatedAt?.toMillis) return true;
  return Date.now() - lock.updatedAt.toMillis() > PMA_FIELD_LOCK_STALE_MS;
}

export function subscribePmaFieldLocks(manifestationId, pazienteDocId, onChange) {
  if (!manifestationId || !pazienteDocId) return () => {};
  const ref = lockRef(manifestationId, pazienteDocId);
  return onSnapshot(ref, (snap) => {
    const fields = snap.exists() ? snap.data()?.fields ?? {} : {};
    onChange(fields);
  });
}

/** Rivendica il campo (heartbeat su focus ripetuto). */
export async function claimPmaFieldLock(manifestationId, pazienteDocId, fieldKey, operator) {
  if (!fieldKey || !operator?.uid) return;
  const ref = lockRef(manifestationId, pazienteDocId);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    const fields = snap.exists() ? snap.data()?.fields ?? {} : {};
    const current = fields[fieldKey];
    if (current && current.uid !== operator.uid && !isStale(current)) {
      throw new Error('FIELD_LOCKED');
    }
    const payload = {
      uid: operator.uid,
      displayName: operator.displayName ?? '',
      nomeUtente: operator.nomeUtente ?? '',
      updatedAt: serverTimestamp(),
    };
    if (snap.exists()) {
      transaction.update(ref, { [`fields.${fieldKey}`]: payload });
    } else {
      transaction.set(ref, { fields: { [fieldKey]: payload } });
    }
  });
}

/** Rilascia il lock se ancora intestato a questo operatore. */
export async function releasePmaFieldLock(manifestationId, pazienteDocId, fieldKey, uid) {
  if (!fieldKey || !uid) return;
  const ref = lockRef(manifestationId, pazienteDocId);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) return;
    const fields = snap.data()?.fields ?? {};
    const current = fields[fieldKey];
    if (!current || current.uid !== uid) return;
    const next = { ...fields };
    delete next[fieldKey];
    if (Object.keys(next).length === 0) {
      transaction.delete(ref);
    } else {
      transaction.update(ref, { [`fields.${fieldKey}`]: deleteField() });
    }
  });
}

export function foreignLockForField(fields, fieldKey, myUid) {
  const lock = fields?.[fieldKey];
  if (!lock || !lock.uid || lock.uid === myUid) return null;
  if (isStale(lock)) return null;
  return lock;
}

export class PmaFieldLockedError extends Error {
  /** @param {string} fieldKey @param {object} lock */
  constructor(fieldKey, lock) {
    const who =
      String(lock?.displayName ?? '').trim() ||
      String(lock?.nomeUtente ?? '').trim() ||
      'un altro operatore';
    super(`Il campo «${fieldKey}» è in modifica da ${who}. Attendi o chiedi di rilasciare il focus.`);
    this.name = 'PmaFieldLockedError';
    this.fieldKey = fieldKey;
    this.lock = lock;
  }
}

/** Verifica lock (snapshot transazione) prima di scrivere campi PMA. */
export function assertPmaFieldLocksWritable(lockFields, fieldKeys, operatorUid) {
  if (!operatorUid || !fieldKeys?.length) return;
  for (const fieldKey of fieldKeys) {
    const foreign = foreignLockForField(lockFields, fieldKey, operatorUid);
    if (foreign) {
      throw new PmaFieldLockedError(fieldKey, foreign);
    }
  }
}
