import { Timestamp } from 'firebase/firestore';
import {
  defaultSoreuOraMissione,
  emptySoreuTrasportoFields,
  normalizeSoreuAccompagnato,
  normalizeSoreuCodice,
  soreuFieldsForFirestore,
} from './soreuTrasporto';

const PREFIX = 'invio_ps_soreu_';

export function invioPsSoreuFieldsFromScheda(scheda = {}) {
  if (!scheda || typeof scheda !== 'object') return emptySoreuTrasportoFields();
  return {
    soreuOraMissione: scheda[`${PREFIX}ora_missione`] ?? null,
    soreuNumeroMissione: scheda[`${PREFIX}numero_missione`] ?? '',
    soreuAccompagnato: normalizeSoreuAccompagnato(scheda[`${PREFIX}accompagnato`]),
    soreuCodice: normalizeSoreuCodice(scheda[`${PREFIX}codice`]),
  };
}

export function invioPsSoreuPatchForScheda(values) {
  const normalized = soreuFieldsForFirestore(values);
  return {
    [`${PREFIX}ora_missione`]: normalized.soreuOraMissione ?? null,
    [`${PREFIX}numero_missione`]: normalized.soreuNumeroMissione,
    [`${PREFIX}accompagnato`]: normalized.soreuAccompagnato,
    [`${PREFIX}codice`]: normalized.soreuCodice,
  };
}

export function defaultInvioPsSoreuOraMissione() {
  return defaultSoreuOraMissione();
}

export function invioPsSoreuOraInitIfEmpty(scheda = {}) {
  if (scheda[`${PREFIX}ora_missione`]) return {};
  return { [`${PREFIX}ora_missione`]: Timestamp.now() };
}
