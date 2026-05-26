import { omitUndefinedFields } from '../../lib/firestorePatch';
import { lockKeyForPmaSchedaField } from './pmaFieldLockKeys';
import { mergeEoQuickColumnSelection } from './eoQuickSelection';
import { mergeSchedaArrayById } from './pmaSchedaArrayMerge';

const PMA_SCHEDA_PREFIX = 'pmaScheda.';

export function isFirestoreFieldValue(value) {
  return (
    value != null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    ('_methodName' in value || value.constructor?.name === 'FieldValue')
  );
}

/** Confronto valore client/server (evita write inutili). */
export function valuesEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return a == b;
  if (typeof a === 'object' && typeof b === 'object') {
    if (typeof a.toMillis === 'function' && typeof b.toMillis === 'function') {
      return a.toMillis() === b.toMillis();
    }
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }
  return false;
}

function readCurrentValue(snapData, dotPath) {
  if (!dotPath.startsWith(PMA_SCHEDA_PREFIX)) {
    return snapData?.[dotPath];
  }
  const field = dotPath.slice(PMA_SCHEDA_PREFIX.length);
  return snapData?.pmaScheda?.[field];
}

/**
 * Da piano patch + snapshot paziente → solo path Firestore realmente cambiati.
 * @param {object} snapData — `snap.data()` paziente
 * @param {{ direct: Record<string, unknown>, eoMerges: object[], arrayMerges: object[] }} plan
 */
export function buildGranularUpdatesFromSnapshot(snapData, plan) {
  const updates = {};
  const scheda = snapData?.pmaScheda ?? {};

  for (const [path, value] of Object.entries(plan.direct ?? {})) {
    if (isFirestoreFieldValue(value)) {
      updates[path] = value;
      continue;
    }
    const current = readCurrentValue(snapData, path);
    if (!valuesEqual(current, value)) {
      updates[path] = value;
    }
  }

  for (const { field, payload } of plan.eoMerges ?? []) {
    const server = Array.isArray(scheda[field]) ? scheda[field] : [];
    const merged = mergeEoQuickColumnSelection(
      server,
      payload.baseAtOpen ?? [],
      payload.draft ?? [],
      payload.columnLabels ?? [],
    );
    if (!valuesEqual(server, merged)) {
      updates[`${PMA_SCHEDA_PREFIX}${field}`] = merged;
    }
  }

  for (const { field, value } of plan.arrayMerges ?? []) {
    const raw = scheda[field];
    const merged =
      field === 'prestazioni_sel'
        ? Array.isArray(value)
          ? value
          : raw
        : mergeSchedaArrayById(raw, value);
    if (!valuesEqual(raw, merged)) {
      updates[`${PMA_SCHEDA_PREFIX}${field}`] = merged;
    }
  }

  return omitUndefinedFields(updates);
}

export function planHasSchedaWrites(plan) {
  if (Object.keys(plan.direct ?? {}).some((p) => p.startsWith(PMA_SCHEDA_PREFIX))) {
    return true;
  }
  return (plan.eoMerges?.length ?? 0) > 0 || (plan.arrayMerges?.length ?? 0) > 0;
}

export function lockKeysFromPlan(plan) {
  const keys = new Set();
  for (const path of Object.keys(plan.direct ?? {})) {
    if (!path.startsWith(PMA_SCHEDA_PREFIX)) continue;
    const lk = lockKeyForPmaSchedaField(path.slice(PMA_SCHEDA_PREFIX.length));
    if (lk) keys.add(lk);
  }
  for (const { field } of plan.eoMerges ?? []) {
    const lk = lockKeyForPmaSchedaField(field);
    if (lk) keys.add(lk);
  }
  for (const { field } of plan.arrayMerges ?? []) {
    const lk = lockKeyForPmaSchedaField(field);
    if (lk) keys.add(lk);
  }
  return [...keys];
}
