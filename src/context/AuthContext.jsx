import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { COLLECTIONS } from '../lib/firestorePaths';
import { useTenantContext } from './TenantContext';
import { authEmailFromNomeUtente } from '../lib/authIdentity';
import { logUserActivity } from '../services/activityLogService';
import { createUserProfile } from '../services/userProfileService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { tenantId } = useTenantContext();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
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
      return undefined;
    }
    let cancelled = false;
    (async () => {
      const snap = await getDoc(
        doc(db, COLLECTIONS.manifestazioni, tenantId, 'userProfiles', user.uid),
      );
      if (cancelled) return;
      if (snap.exists()) {
        setProfile(snap.data());
      } else {
        setProfile({
          nome: user.displayName ?? '',
          nomeUtente: '',
        });
      }
    })();
    return () => {
      cancelled = true;
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

  const register = useCallback(
    async ({ nome, nomeUtente, password }) => {
      if (!tenantId) throw new Error('Manifestazione non disponibile.');
      const email = authEmailFromNomeUtente(nomeUtente, tenantId);
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const nomeTrim = nome?.trim() ?? '';
      await updateProfile(cred.user, { displayName: nomeTrim });
      await createUserProfile(tenantId, cred.user.uid, {
        nome: nomeTrim,
        nomeUtente: nomeUtente.trim(),
      });
      await logUserActivity(tenantId, {
        uid: cred.user.uid,
        nomeUtente: nomeUtente.trim(),
        nome: nomeTrim,
        type: 'REGISTER',
        detail: null,
        path:
          typeof window !== 'undefined'
            ? `${window.location.pathname}${window.location.search}`
            : null,
      });
    },
    [tenantId],
  );

  const login = useCallback(
    async ({ nomeUtente, password }) => {
      if (!tenantId) throw new Error('Manifestazione non disponibile.');
      const email = authEmailFromNomeUtente(nomeUtente, tenantId);
      const cred = await signInWithEmailAndPassword(auth, email, password);
      await logUserActivity(tenantId, {
        uid: cred.user.uid,
        nomeUtente: nomeUtente.trim(),
        nome: cred.user.displayName ?? null,
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
    await signOut(auth);
  }, [tenantId, user, profile]);

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      register,
      login,
      logout,
      logActivity,
    }),
    [user, profile, loading, register, login, logout, logActivity],
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
