/** @typedef {'CENTRALE' | 'PMA'} AccessType */
/** @typedef {'MEDICO' | 'INFERMIERE' | 'SOCCORRITORE'} PmaRankCode */

export const ACCESS_TYPE = {
  CENTRALE: 'CENTRALE',
  PMA: 'PMA',
};

export const PMA_RANK = {
  MEDICO: 'MEDICO',
  INFERMIERE: 'INFERMIERE',
  SOCCORRITORE: 'SOCCORRITORE',
};

export const PMA_RANK_LABEL = {
  [PMA_RANK.MEDICO]: 'Medico',
  [PMA_RANK.INFERMIERE]: 'Infermiere',
  [PMA_RANK.SOCCORRITORE]: 'Soccorritore',
};

/** Rank per componenti portati da PMApp (title case). */
export function normalizePmaRank(value) {
  const v = String(value ?? '')
    .trim()
    .toUpperCase();
  if (v === PMA_RANK.INFERMIERE) return 'Infermiere';
  if (v === PMA_RANK.SOCCORRITORE) return 'Soccorritore';
  return 'Medico';
}

export function normalizeAccessType(value) {
  const v = String(value ?? '')
    .trim()
    .toUpperCase();
  return v === ACCESS_TYPE.PMA ? ACCESS_TYPE.PMA : ACCESS_TYPE.CENTRALE;
}

export function profileHasCentraleAccess(profile, isSuperAdmin) {
  if (isSuperAdmin) return true;
  if (!profile) return true;
  if (normalizeAccessType(profile.accessType) === ACCESS_TYPE.CENTRALE) return true;
  return !String(profile.pmaScopeId ?? '').trim() && !profile.accessType;
}
