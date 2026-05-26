/** @typedef {'CENTRALE' | 'PMA'} AccessType */
/** @typedef {'MEDICO' | 'INFERMIERE' | 'SOCCORRITORE'} PmaRankCode */

import { isPmaOperatorProfile, userHasFullCentraleAccess } from './pmaModule';

export const ACCESS_TYPE = {
  CENTRALE: 'CENTRALE',
  PMA: 'PMA',
};

export const PMA_RANK = {
  MEDICO: 'MEDICO',
  INFERMIERE: 'INFERMIERE',
  SOCCORRITORE: 'SOCCORRITORE',
  TRIAGE: 'TRIAGE',
};

export const PMA_RANK_LABEL = {
  [PMA_RANK.MEDICO]: 'Medico',
  [PMA_RANK.INFERMIERE]: 'Infermiere',
  [PMA_RANK.SOCCORRITORE]: 'Soccorritore',
  [PMA_RANK.TRIAGE]: 'Triage',
};

/** Rank per componenti PMA (title case). Restituisce null se non configurato (fail-closed sui permessi). */
export function normalizePmaRank(value) {
  const v = String(value ?? '')
    .trim()
    .toUpperCase();
  if (v === PMA_RANK.INFERMIERE) return 'Infermiere';
  if (v === PMA_RANK.SOCCORRITORE) return 'Soccorritore';
  if (v === PMA_RANK.MEDICO) return 'Medico';
  if (v === PMA_RANK.TRIAGE) return 'Triage';
  return null;
}

/**
 * Rank effettivo per permessi scheda PMA (matrice Rank).
 * Centrale / superadmin non hanno `pmaRank` ma devono poter dimettere e gestire la cartella.
 */
export function effectivePmaUserRank(profile, isSuperAdmin = false) {
  if (isSuperAdmin) return 'Superadmin';
  if (userHasFullCentraleAccess(profile, false)) return 'Centrale';
  return normalizePmaRank(profile?.pmaRank);
}

export function normalizeAccessType(value) {
  const v = String(value ?? '')
    .trim()
    .toUpperCase();
  return v === ACCESS_TYPE.PMA ? ACCESS_TYPE.PMA : ACCESS_TYPE.CENTRALE;
}

/** Rotte accessibili agli operatori PMA (accessType PMA + pmaScopeId). */
export const PMA_OPERATOR_NAV_PATHS = ['/pma', '/pazienti', '/diario', '/account'];

export function isPathAllowedForPmaOperator(pathname) {
  const path = String(pathname ?? '').split('?')[0];
  return PMA_OPERATOR_NAV_PATHS.some((base) => path === base || path.startsWith(`${base}/`));
}

export function profileHasCentraleAccess(profile, isSuperAdmin) {
  if (isSuperAdmin) return true;
  if (!profile) return false;
  if (normalizeAccessType(profile.accessType) === ACCESS_TYPE.CENTRALE) return true;
  return userHasFullCentraleAccess(profile, false);
}

/** Operatore PMA con rank Medico (pagina Account / firma dimissione). */
export function isPmaMedicoAccount(profile) {
  if (!isPmaOperatorProfile(profile)) return false;
  return normalizePmaRank(profile?.pmaRank) === 'Medico';
}
