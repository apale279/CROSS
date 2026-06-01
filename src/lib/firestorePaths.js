import { TENANT_ID } from '../constants';
import { assertWritableTenant } from './sandboxMode';

/** Collezioni root (legacy: `manifestazioni` contiene un solo documento tenant) */
export const COLLECTIONS = {
  manifestazioni: 'manifestazioni',
  eventi: 'eventi',
  missioni: 'missioni',
  mezzi: 'mezzi',
  pazienti: 'pazienti',
  impostazioni: 'impostazioni',
  telegram_users: 'telegram_users',
  note_diario: 'note_diario',
};

export const manifestazioniCollection = () => [COLLECTIONS.manifestazioni];

function resolveTenantId(tenantId) {
  const id = (tenantId ?? TENANT_ID)?.trim?.() ?? '';
  if (id) assertWritableTenant(id);
  return id;
}

/** Percorsi operativi: `manifestazioni/{tenantId}/…` (default: TENANT_ID da env) */
export const eventiPath = (tenantId = TENANT_ID) => [
  'manifestazioni',
  resolveTenantId(tenantId),
  'eventi',
];
export const missioniPath = (tenantId = TENANT_ID) => [
  'manifestazioni',
  resolveTenantId(tenantId),
  'missioni',
];
export const mezziPath = (tenantId = TENANT_ID) => [
  'manifestazioni',
  resolveTenantId(tenantId),
  'mezzi',
];
export const pazientiPath = (tenantId = TENANT_ID) => [
  'manifestazioni',
  resolveTenantId(tenantId),
  'pazienti',
];
export const impostazioniPath = (tenantId = TENANT_ID) => [
  'manifestazioni',
  resolveTenantId(tenantId),
  'settings',
  'impostazioni',
];

export const telegramUsersPath = (tenantId = TENANT_ID) => [
  'manifestazioni',
  resolveTenantId(tenantId),
  'telegram_users',
];

/** Segmenti della sotto-collezione valutazioni: `collection(db, …pazientiPath, pid, valutazioniSoccorso)`. */
export const pazienteValutazioniSoccorsoPathSegments = (tenantId, pazienteDocId) => [
  ...pazientiPath(tenantId),
  pazienteDocId,
  'valutazioniSoccorso',
];

/** Sotto `impostazioni` doc: manifestazioni/{id}/settings/impostazioni/registryPartecipanti */
export const registryPartecipantiPathSegments = (tenantId = TENANT_ID) => [
  ...impostazioniPath(tenantId),
  'registryPartecipanti',
];

export const noteDiarioPath = (tenantId = TENANT_ID) => [
  'manifestazioni',
  resolveTenantId(tenantId),
  'note_diario',
];

export const PATH_BY_KEY = {
  eventi: eventiPath,
  missioni: missioniPath,
  mezzi: mezziPath,
  pazienti: pazientiPath,
  note_diario: noteDiarioPath,
};
