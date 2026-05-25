import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { COLLECTIONS } from '../lib/firestorePaths';
import { useTenantContext } from './TenantContext';
import { logUserActivity } from '../services/activityLogService';
import { ensureUserSessionToken } from '../services/deviceSessionService';
import { writeStoredUserSessionToken } from '../lib/deviceSession';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { tenantId } = useTenantContext();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user || !tenantId) {
      setProfile(null);
      setProfileLoading(false);
      return undefined;
    }
    setProfileLoading(true);
    const ref = doc(db, COLLECTIONS.manifestazioni, tenantId, 'userProfiles', user.uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setProfile(snap.data());
        } else {
          setProfile(null);
        }
        setProfileLoading(false);
      },
      () => {
        setProfile(null);
        setProfileLoading(false);
      },
    );
    return () => {
      unsub();
    };
  }, [user, tenantId]);

  const logActivity = useCallback(
    async (type, detail) => {
      if (!tenantId || !user) return;
      const nomeUtente = profile?.nomeUtente ?? null;
      const nome = profile?.nome ?? user.displayName ?? null;
      const path =
        typeof window !== 'undefined'
          ? `${window.location.pathname}${window.location.search}`
          : null;
      try {
        await logUserActivity(tenantId, {
          uid: user.uid,
          nomeUtente,
          nome,
          type,
          detail: detail ?? null,
          path,
        });
      } catch (e) {
        console.warn('Registro attività non salvato:', e);
      }
    },
    [tenantId, user, profile],
  );

  const refreshProfile = useCallback(async () => {
    if (!user || !tenantId) return null;
    const snap = await getDoc(
      doc(db, COLLECTIONS.manifestazioni, tenantId, 'userProfiles', user.uid),
    );
    const next = snap.exists() ? snap.data() : null;
    setProfile(next);
    return next;
  }, [user, tenantId]);

  const login = useCallback(
    async ({ email, password }) => {
      if (!tenantId) throw new Error('Manifestazione non disponibile.');
      const emailNorm = String(email ?? '').trim();
      if (!emailNorm) throw new Error("Inserisci l'indirizzo email.");
      const cred = await signInWithEmailAndPassword(auth, emailNorm, password);
      const sessionToken = await ensureUserSessionToken(tenantId, cred.user.uid);
      writeStoredUserSessionToken(tenantId, cred.user.uid, sessionToken);

      const profSnap = await getDoc(
        doc(db, COLLECTIONS.manifestazioni, tenantId, 'userProfiles', cred.user.uid),
      );
      const prof = profSnap.exists() ? profSnap.data() : null;
      setProfile(prof);

      await logUserActivity(tenantId, {
        uid: cred.user.uid,
        nomeUtente: prof?.nomeUtente ?? null,
        nome: prof?.nome ?? cred.user.displayName ?? null,
        type: 'LOGIN',
        detail: null,
        path:
          typeof window !== 'undefined'
            ? `${window.location.pathname}${window.location.search}`
            : null,
      });
    },
    [tenantId],
  );

  const logout = useCallback(async () => {
    if (tenantId && user) {
      try {
        await logUserActivity(tenantId, {
          uid: user.uid,
          nomeUtente: profile?.nomeUtente ?? null,
          nome: profile?.nome ?? user.displayName ?? null,
          type: 'LOGOUT',
          detail: null,
          path:
            typeof window !== 'undefined'
              ? `${window.location.pathname}${window.location.search}`
              : null,
        });
      } catch (e) {
        console.warn('Registro logout non salvato:', e);
      }
    }
    if (tenantId && user?.uid) {
      writeStoredUserSessionToken(tenantId, user.uid, null);
    }
    await signOut(auth);
  }, [tenantId, user, profile]);

  const value = useMemo(
    () => ({
      user,
      profile,
      profileLoading,
      loading,
      login,
      logout,
      logActivity,
      refreshProfile,
    }),
    [user, profile, profileLoading, loading, login, logout, logActivity, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth deve essere usato dentro AuthProvider');
  }
  return ctx;
}
