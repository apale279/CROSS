import { DEFAULT_IMPOSTAZIONI } from '../constants';

/** Mappe annidate: vietato riscrivere l'oggetto intero con saveImpostazioniField. */
export const IMPOSTAZIONI_NESTED_OBJECT_FIELDS = new Set([
  'dettagliPerTipoEvento',
  'dettagliPerTipoLuogo',
  'pmaClinica',
  'codiciMinoriTabellaFoto',
]);

/** Array di oggetti: aggiornare una voce per volta (transazione server-side). */
export const IMPOSTAZIONI_TRANSACTIONAL_ARRAY_FIELDS = new Set(['stazionamenti', 'pma']);

export function isImpostazioniNestedObjectField(fieldKey) {
  return IMPOSTAZIONI_NESTED_OBJECT_FIELDS.has(fieldKey);
}

export function isImpostazioniTransactionalArrayField(fieldKey) {
  return IMPOSTAZIONI_TRANSACTIONAL_ARRAY_FIELDS.has(fieldKey);
}

export function isImpostazioniFieldSaveBlocked(fieldKey) {
  return (
    isImpostazioniNestedObjectField(fieldKey) || isImpostazioniTransactionalArrayField(fieldKey)
  );
}

/** Valore grezzo Firestore (mai default di merge per scritture). */
export function readImpostazioniFieldRaw(data, fieldKey) {
  if (!data || fieldKey == null || fieldKey === '') return undefined;
  return data[fieldKey];
}

/** Valore per UI: default solo in lettura, mai persistiti implicitamente. */
export function readImpostazioniFieldForDisplay(data, fieldKey) {
  const raw = readImpostazioniFieldRaw(data, fieldKey);
  if (raw !== undefined && raw !== null) return raw;

  if (fieldKey === 'dettagliPerTipoEvento' || fieldKey === 'dettagliPerTipoLuogo') {
    return {};
  }
  if (fieldKey === 'pma' || fieldKey === 'stazionamenti') return [];
  if (fieldKey === 'mappaDashboardDefault' || fieldKey === 'piantina_url' || fieldKey === 'guida_pdf_url') {
    return null;
  }
  if (fieldKey === 'luogo_fisico') return '';
  if (fieldKey === 'pmaClinica') return DEFAULT_IMPOSTAZIONI.pmaClinica;
  if (fieldKey === 'codiciMinoriTabellaFoto') return DEFAULT_IMPOSTAZIONI.codiciMinoriTabellaFoto;
  if (fieldKey === 'tipiLuogo') return [...DEFAULT_IMPOSTAZIONI.tipiLuogo];
  if (fieldKey === 'chiamantiEvento') return [...DEFAULT_IMPOSTAZIONI.chiamantiEvento];
  if (fieldKey === 'lesioniLocalizzazioni') return [...DEFAULT_IMPOSTAZIONI.lesioniLocalizzazioni];
  if (fieldKey === 'lesioniTipologie') return [...DEFAULT_IMPOSTAZIONI.lesioniTipologie];
  if (fieldKey === 'lesioniVasMax') return DEFAULT_IMPOSTAZIONI.lesioniVasMax;
  if (fieldKey === 'msbMsaPresidi') return [...DEFAULT_IMPOSTAZIONI.msbMsaPresidi];
  if (fieldKey === 'prestazioniMsb') return [...DEFAULT_IMPOSTAZIONI.prestazioniMsb];
  if (fieldKey === 'prestazioniMsa') return [...DEFAULT_IMPOSTAZIONI.prestazioniMsa];
  return DEFAULT_IMPOSTAZIONI[fieldKey] ?? null;
}

/** Chiave Firestore sicura per path puntati (tipo luogo/evento). */
export function impostazioniMapFieldPath(parentField, mapKey) {
  const key = String(mapKey ?? '').trim();
  if (!key) throw new Error('Chiave mappa impostazioni non valida.');
  if (key.includes('.')) {
    throw new Error(`La chiave «${key}» non può contenere il carattere «.».`);
  }
  return `${parentField}.${key}`;
}
