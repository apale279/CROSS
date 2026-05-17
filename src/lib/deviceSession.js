const STORAGE_PREFIX = 'cross:device-session:';

export function createSessionToken() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export function userSessionStorageKey(tenantId, uid) {
  return `${STORAGE_PREFIX}${tenantId}:${uid}`;
}

export function mezzoSessionStorageKey(tenantId, sigla) {
  return `${STORAGE_PREFIX}mezzo:${tenantId}:${sigla}`;
}

export function readStoredUserSessionToken(tenantId, uid) {
  try {
    return sessionStorage.getItem(userSessionStorageKey(tenantId, uid));
  } catch {
    return null;
  }
}

export function writeStoredUserSessionToken(tenantId, uid, token) {
  try {
    if (token) sessionStorage.setItem(userSessionStorageKey(tenantId, uid), token);
    else sessionStorage.removeItem(userSessionStorageKey(tenantId, uid));
  } catch {
    /* ignore */
  }
}

export function readStoredMezzoSessionToken(tenantId, sigla) {
  try {
    return sessionStorage.getItem(mezzoSessionStorageKey(tenantId, sigla));
  } catch {
    return null;
  }
}

export function writeStoredMezzoSessionToken(tenantId, sigla, token) {
  try {
    if (token) sessionStorage.setItem(mezzoSessionStorageKey(tenantId, sigla), token);
    else sessionStorage.removeItem(mezzoSessionStorageKey(tenantId, sigla));
  } catch {
    /* ignore */
  }
}

export function readBoundMezzoSigla(tenantId) {
  try {
    return localStorage.getItem(`${STORAGE_PREFIX}bound-mezzo:${tenantId}`);
  } catch {
    return null;
  }
}

export function writeBoundMezzoSigla(tenantId, sigla) {
  try {
    if (sigla) localStorage.setItem(`${STORAGE_PREFIX}bound-mezzo:${tenantId}`, sigla);
    else localStorage.removeItem(`${STORAGE_PREFIX}bound-mezzo:${tenantId}`);
  } catch {
    /* ignore */
  }
}
