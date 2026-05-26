/** Alias Firestore → chiave lock UI (`PmaFieldGuard`). */
const LOCK_KEY_ALIASES = {
  affidatario_nome: 'affidatario',
  affidatario_cognome: 'affidatario',
  affidatario_documento: 'affidatario',
  affidatario_telefono: 'affidatario',
  affidatario_note: 'affidatario',
};

/** Mappa campo `pmaScheda.*` alla chiave usata nel documento `pmaPresence/locks`. */
export function lockKeyForPmaSchedaField(field) {
  const key = String(field ?? '').trim();
  if (!key) return '';
  return LOCK_KEY_ALIASES[key] ?? key;
}

const PMA_SCHEDA_PREFIX = 'pmaScheda.';

/** Chiavi lock da path puntati (`pmaScheda.farmaci` → `farmaci`). */
export function lockKeysFromFlattenedFields(flatFields) {
  const keys = new Set();
  for (const path of Object.keys(flatFields ?? {})) {
    if (!path.startsWith(PMA_SCHEDA_PREFIX)) continue;
    const field = path.slice(PMA_SCHEDA_PREFIX.length);
    const lk = lockKeyForPmaSchedaField(field);
    if (lk) keys.add(lk);
  }
  return [...keys];
}
