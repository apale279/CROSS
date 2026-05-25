import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTenantContext } from '../../context/TenantContext';
import {
  initSessionDeviceClass,
  isInactivityExpired,
  lastActivityStorageKey,
  readSessionDeviceClass,
  getInactivityLimitMs,
  writeLastActivity,
} from '../../lib/inactivityLogout';

const CHECK_INTERVAL_MS = 30_000;
const ACTIVITY_THROTTLE_MS = 5_000;

const ACTIVITY_EVENTS = [
  'mousedown',
  'mousemove',
  'keydown',
  'keyup',
  'scroll',
  'touchstart',
  'touchend',
  'click',
  'pointerdown',
  'input',
  'change',
  'focusin',
];

/**
 * Disconnette l'utente dopo inattività:
 * - desktop: 30 min
 * - telefono / tablet: 1 h
 */
export function InactivityLogoutGuard() {
  const { user, logout } = useAuth();
  const { tenantId } = useTenantContext();
  const navigate = useNavigate();
  const signingOutRef = useRef(false);
  const lastBumpRef = useRef(0);

  useEffect(() => {
    if (!user?.uid || !tenantId) return undefined;

    initSessionDeviceClass();

    if (isInactivityExpired(tenantId, user.uid)) {
      signingOutRef.current = true;
      void logout()
        .then(() => navigate('/login?inactive=1', { replace: true }))
        .catch(() => navigate('/login?inactive=1', { replace: true }));
      return undefined;
    }

    writeLastActivity(tenantId, user.uid);

    const bump = () => {
      const now = Date.now();
      if (now - lastBumpRef.current < ACTIVITY_THROTTLE_MS) return;
      lastBumpRef.current = now;
      writeLastActivity(tenantId, user.uid, now);
    };

    const check = () => {
      if (signingOutRef.current) return;
      if (!isInactivityExpired(tenantId, user.uid)) return;
      signingOutRef.current = true;
      void logout()
        .then(() => {
          navigate('/login?inactive=1', { replace: true });
        })
        .catch(() => {
          signingOutRef.current = false;
          navigate('/login?inactive=1', { replace: true });
        });
    };

    const onStorage = (ev) => {
      if (ev.key !== lastActivityStorageKey(tenantId, user.uid)) return;
      check();
    };

    const onVisibility = () => {
      if (!document.hidden) check();
    };

    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, bump, { passive: true, capture: true });
    }
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('storage', onStorage);

    const intervalId = window.setInterval(check, CHECK_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
      for (const ev of ACTIVITY_EVENTS) {
        window.removeEventListener(ev, bump, { capture: true });
      }
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('storage', onStorage);
    };
  }, [user?.uid, tenantId, logout, navigate]);

  return null;
}

/** Etichetta per messaggi UI (login / impostazioni). */
export function inactivityLogoutLabel() {
  const mins = Math.round(getInactivityLimitMs() / 60_000);
  const device = readSessionDeviceClass() === 'mobile' ? 'telefono/tablet' : 'computer';
  return `${mins} min (${device})`;
}
