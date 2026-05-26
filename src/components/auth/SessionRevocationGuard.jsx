import { useEffect, useRef } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '../../firebaseConfig';
import { useAuth } from '../../context/AuthContext';
import { useTenantContext } from '../../context/TenantContext';
import { mezziPath } from '../../lib/firestorePaths';
import { userProfileDocRef } from '../../services/userProfileService';
import {
  readBoundMezzoSigla,
  readStoredMezzoSessionToken,
  readStoredUserSessionToken,
  writeStoredMezzoSessionToken,
  writeStoredUserSessionToken,
} from '../../lib/deviceSession';
import { ensureUserSessionToken } from '../../services/deviceSessionService';

/**
 * Disconnette il dispositivo se active_session_token su profilo o mezzo
 * non corrisponde più al token locale (logout globale da amministrazione).
 */
export function SessionRevocationGuard() {
  const { user } = useAuth();
  const { tenantId } = useTenantContext();
  const signingOutRef = useRef(false);

  useEffect(() => {
    if (!user?.uid || !tenantId) return undefined;

    const profileRef = userProfileDocRef(tenantId, user.uid);
    let unsub = () => {};
    let cancelled = false;

    void (async () => {
      let localToken = readStoredUserSessionToken(tenantId, user.uid);
      if (!localToken) {
        const snap = await getDoc(profileRef);
        if (cancelled) return;
        const remote = snap.exists() ? snap.data()?.active_session_token : null;
        if (typeof remote === 'string' && remote.length > 0) {
          writeStoredUserSessionToken(tenantId, user.uid, remote);
          localToken = remote;
        } else {
          const issued = await ensureUserSessionToken(tenantId, user.uid);
          if (cancelled) return;
          writeStoredUserSessionToken(tenantId, user.uid, issued);
          localToken = issued;
        }
      }

      if (cancelled) return;
      const boundToken = localToken;
      unsub = onSnapshot(profileRef, (snap) => {
        if (signingOutRef.current) return;
        const remote = snap.exists() ? snap.data()?.active_session_token : null;
        if (remote == null || remote !== boundToken) {
          signingOutRef.current = true;
          writeStoredUserSessionToken(tenantId, user.uid, null);
          void signOut(auth);
        }
      });
    })();

    return () => {
      cancelled = true;
      unsub();
    };
  }, [user?.uid, tenantId]);

  useEffect(() => {
    if (!tenantId) return undefined;
    const sigla = readBoundMezzoSigla(tenantId);
    if (!sigla) return undefined;

    const localToken = readStoredMezzoSessionToken(tenantId, sigla);
    if (!localToken) return undefined;

    const mezzoRef = doc(db, ...mezziPath(tenantId), sigla);

    const unsub = onSnapshot(mezzoRef, (snap) => {
      if (signingOutRef.current) return;
      const remote = snap.exists() ? snap.data()?.active_session_token : null;
      if (remote == null || remote !== localToken) {
        signingOutRef.current = true;
        writeStoredMezzoSessionToken(tenantId, sigla, null);
        void signOut(auth);
      }
    });

    return () => unsub();
  }, [tenantId]);

  return null;
}
