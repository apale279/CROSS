/** Matrice permessi scheda PMA (da Rank.xlsx / documento integrazione). */
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
const CARTELLA_UPDATE: UserRank[] = ['Superadmin', 'Medico', 'Infermiere', 'Soccorritore'];

const DIMISSIONE_READ: UserRank[] = ['Superadmin', 'Centrale', 'Medico'];
const DIMISSIONE_UPDATE: UserRank[] = ['Superadmin', 'Centrale', 'Medico'];

const INVIO_PS_READ: UserRank[] = ['Superadmin', 'Centrale', 'Medico'];
const INVIO_PS_UPDATE: UserRank[] = ['Superadmin', 'Centrale', 'Medico'];

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

/** Solo Centrale può impostare stato «in arrivo». */
export function schedaStatoInArrivoAllows(rank: UserRank): boolean {
  return rank === 'Superadmin' || rank === 'Centrale';
}

/** Invio PS: Centrale e Medico con scheda aperta. */
export function canWriteInvioPsFields(rank: UserRank, schedaAperta: boolean): boolean {
  if (!schedaAperta) return false;
  return rank === 'Superadmin' || rank === 'Centrale' || rank === 'Medico';
}
