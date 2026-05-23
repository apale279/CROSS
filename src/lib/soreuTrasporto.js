import { Timestamp } from 'firebase/firestore';

export const SOREU_ACCOMPAGNATO_OPTS = ['NO', 'MEDICO', 'INFERMIERE'];
export const SOREU_CODICE_OPTS = ['B', 'V', 'G', 'R'];

export function emptySoreuTrasportoFields() {
  return {
    soreuOraMissione: null,
    soreuNumeroMissione: '',
    soreuAccompagnato: ['NO'],
    soreuCodice: '',
  };
}

export function normalizeSoreuAccompagnato(raw) {
  if (!Array.isArray(raw) || !raw.length) return ['NO'];
  const picked = raw.filter((x) => SOREU_ACCOMPAGNATO_OPTS.includes(x));
  if (!picked.length) return ['NO'];
  if (picked.includes('NO') && picked.length > 1) {
    return picked.filter((x) => x !== 'NO');
  }
  return picked.includes('NO') ? ['NO'] : picked;
}

export function toggleSoreuAccompagnato(current, opt) {
  const cur = normalizeSoreuAccompagnato(current);
  if (opt === 'NO') return ['NO'];
  const withoutNo = cur.filter((x) => x !== 'NO');
  if (withoutNo.includes(opt)) {
    const next = withoutNo.filter((x) => x !== opt);
    return next.length ? next : ['NO'];
  }
  return [...withoutNo, opt];
}

export function normalizeSoreuCodice(raw) {
  const c = String(raw ?? '').trim().toUpperCase();
  return SOREU_CODICE_OPTS.includes(c) ? c : '';
}

export function soreuFieldsFromPatient(p) {
  if (!p) return emptySoreuTrasportoFields();
  return {
    soreuOraMissione: p.soreuOraMissione ?? null,
    soreuNumeroMissione: p.soreuNumeroMissione ?? '',
    soreuAccompagnato: normalizeSoreuAccompagnato(p.soreuAccompagnato),
    soreuCodice: normalizeSoreuCodice(p.soreuCodice),
  };
}

export function defaultSoreuOraMissione() {
  return Timestamp.now();
}

export function soreuFieldsForFirestore(values) {
  return {
    soreuOraMissione: values.soreuOraMissione ?? null,
    soreuNumeroMissione: String(values.soreuNumeroMissione ?? '').trim(),
    soreuAccompagnato: normalizeSoreuAccompagnato(values.soreuAccompagnato),
    soreuCodice: normalizeSoreuCodice(values.soreuCodice),
  };
}

export function emptySoreuFirestoreClear() {
  return {
    soreuOraMissione: null,
    soreuNumeroMissione: '',
    soreuAccompagnato: ['NO'],
    soreuCodice: '',
  };
}
