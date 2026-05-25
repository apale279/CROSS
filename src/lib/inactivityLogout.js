/** Desktop: logout dopo 30 min senza interazione. */
export const INACTIVITY_LOGOUT_DESKTOP_MS = 30 * 60 * 1000;

/** Telefono / tablet: logout dopo 1 ora senza interazione. */
export const INACTIVITY_LOGOUT_MOBILE_MS = 60 * 60 * 1000;

const DEVICE_CLASS_KEY = 'cross:session-device-class';
const LAST_ACTIVITY_PREFIX = 'cross:last-activity:';

/** True se il browser segnala smartphone o tablet (incluso iPad con UA desktop). */
export function isMobileOrTabletDevice() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPhone|iPod|iPad/i.test(ua)) return true;
  if (navigator.maxTouchPoints > 1 && /Macintosh/i.test(ua)) return true;
  if (/Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return true;
  if (/Windows/i.test(ua) && /Touch/i.test(ua)) return true;
  return false;
}

/** Memorizza la classe dispositivo per tutta la sessione browser (fino al logout). */
export function initSessionDeviceClass() {
  const cls = isMobileOrTabletDevice() ? 'mobile' : 'desktop';
  try {
    sessionStorage.setItem(DEVICE_CLASS_KEY, cls);
  } catch {
    /* ignore */
  }
  return cls;
}

export function readSessionDeviceClass() {
  try {
    const v = sessionStorage.getItem(DEVICE_CLASS_KEY);
    if (v === 'mobile' || v === 'desktop') return v;
  } catch {
    /* ignore */
  }
  return initSessionDeviceClass();
}

export function clearSessionDeviceClass() {
  try {
    sessionStorage.removeItem(DEVICE_CLASS_KEY);
  } catch {
    /* ignore */
  }
}

export function getInactivityLimitMs() {
  return readSessionDeviceClass() === 'mobile'
    ? INACTIVITY_LOGOUT_MOBILE_MS
    : INACTIVITY_LOGOUT_DESKTOP_MS;
}

export function lastActivityStorageKey(tenantId, uid) {
  return `${LAST_ACTIVITY_PREFIX}${tenantId}:${uid}`;
}

export function writeLastActivity(tenantId, uid, ts = Date.now()) {
  if (!tenantId || !uid) return;
  try {
    localStorage.setItem(lastActivityStorageKey(tenantId, uid), String(ts));
  } catch {
    /* ignore */
  }
}

export function readLastActivity(tenantId, uid) {
  if (!tenantId || !uid) return null;
  try {
    const raw = localStorage.getItem(lastActivityStorageKey(tenantId, uid));
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function clearLastActivity(tenantId, uid) {
  if (!tenantId || !uid) return;
  try {
    localStorage.removeItem(lastActivityStorageKey(tenantId, uid));
  } catch {
    /* ignore */
  }
}

export function msSinceLastActivity(tenantId, uid) {
  const last = readLastActivity(tenantId, uid);
  if (last == null) return 0;
  return Math.max(0, Date.now() - last);
}

export function isInactivityExpired(tenantId, uid) {
  return msSinceLastActivity(tenantId, uid) >= getInactivityLimitMs();
}
