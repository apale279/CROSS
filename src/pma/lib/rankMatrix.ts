/** Matrice permessi scheda PMA e navigazione operatori tenda. */
export type UserRank =
  | 'Superadmin'
  | 'Centrale'
  | 'Medico'
  | 'Infermiere'
  | 'Soccorritore'
  | 'Triage';

type MatrixAction = 'READ' | 'UPDATE';

const CARTELLA_READ: UserRank[] = [
  'Superadmin',
  'Centrale',
  'Medico',
  'Infermiere',
  'Soccorritore',
];
/** Cartella clinica: tutti i rank PMA possono modificare (con eccezioni puntuali, es. farmaci). */
const CARTELLA_UPDATE: UserRank[] = [
  'Superadmin',
  'Centrale',
  'Medico',
  'Infermiere',
  'Soccorritore',
];

/** Dimissione: Infermiere e Soccorritore solo lettura. */
const DIMISSIONE_READ: UserRank[] = [
  'Superadmin',
  'Centrale',
  'Medico',
  'Infermiere',
  'Soccorritore',
];
const DIMISSIONE_UPDATE: UserRank[] = ['Superadmin', 'Centrale', 'Medico'];

const INVIO_PS_READ: UserRank[] = ['Superadmin', 'Centrale', 'Medico'];
const INVIO_PS_UPDATE: UserRank[] = ['Superadmin', 'Centrale', 'Medico'];

const FARMACI_INSERT: UserRank[] = ['Superadmin', 'Centrale', 'Medico', 'Infermiere'];

function allows(rank: UserRank, allowed: UserRank[], action: MatrixAction): boolean {
  if (!allowed.includes(rank)) return false;
  return action === 'READ' || allowed.includes(rank);
}

export function schedaTabCartellaAllows(rank: UserRank, action: MatrixAction): boolean {
  return allows(rank, action === 'READ' ? CARTELLA_READ : CARTELLA_UPDATE, action);
}

export function schedaTabDimissioneAllows(rank: UserRank, action: MatrixAction): boolean {
  return allows(rank, action === 'READ' ? DIMISSIONE_READ : DIMISSIONE_UPDATE, action);
}

export function schedaTabInvioPsAllows(rank: UserRank, action: MatrixAction): boolean {
  return allows(rank, action === 'READ' ? INVIO_PS_READ : INVIO_PS_UPDATE, action);
}

/** Inserimento / modifica farmaci in cartella: non consentito al Soccorritore. */
export function canInsertFarmaci(rank: UserRank): boolean {
  return FARMACI_INSERT.includes(rank);
}

/** Solo Centrale può impostare stato «in arrivo». */
export function schedaStatoInArrivoAllows(rank: UserRank): boolean {
  return rank === 'Superadmin' || rank === 'Centrale';
}

/** Invio PS: Centrale e Medico se la scheda è modificabile (in carico o sbloccata manualmente). */
export function canWriteInvioPsFields(rank: UserRank, schedaModificabile: boolean): boolean {
  if (!schedaModificabile) return false;
  return rank === 'Superadmin' || rank === 'Centrale' || rank === 'Medico';
}
