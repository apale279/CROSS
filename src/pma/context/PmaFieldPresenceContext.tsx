import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  claimPmaFieldLock,
  foreignLockForField,
  releasePmaFieldLock,
  subscribePmaFieldLocks,
} from '../services/pmaFieldPresenceService';

type LockMap = Record<string, { uid?: string; displayName?: string; nomeUtente?: string }>;

type Ctx = {
  useFieldLock: (fieldKey: string) => {
    isForeign: boolean;
    foreignLabel: string;
    wrapClass: string;
    onFocus: () => void;
    onBlur: () => void;
  };
};

const PmaFieldPresenceContext = createContext<Ctx | null>(null);

type ProviderProps = {
  manifestationId: string;
  pazienteDocId: string;
  children: ReactNode;
};

export function PmaFieldPresenceProvider({
  manifestationId,
  pazienteDocId,
  children,
}: ProviderProps) {
  const { user, profile } = useAuth();
  const [locks, setLocks] = useState<LockMap>({});
  const focusedKeysRef = useRef(new Set<string>());

  useEffect(() => {
    return subscribePmaFieldLocks(manifestationId, pazienteDocId, setLocks);
  }, [manifestationId, pazienteDocId]);

  const operator = useMemo(
    () => ({
      uid: user?.uid ?? '',
      displayName: profile?.nome ?? user?.displayName ?? '',
      nomeUtente: profile?.nomeUtente ?? '',
    }),
    [user, profile],
  );

  const heartbeat = useCallback(
    (fieldKey: string) => {
      if (!fieldKey || !operator.uid) return;
      void claimPmaFieldLock(manifestationId, pazienteDocId, fieldKey, operator).catch(() => {});
    },
    [manifestationId, pazienteDocId, operator],
  );

  useEffect(() => {
    const id = setInterval(() => {
      for (const key of focusedKeysRef.current) {
        heartbeat(key);
      }
    }, 12_000);
    return () => clearInterval(id);
  }, [heartbeat]);

  const useFieldLock = useCallback(
    (fieldKey: string) => {
      const foreign = foreignLockForField(locks, fieldKey, operator.uid);
      const isForeign = Boolean(foreign);
      const foreignLabel = foreign
        ? foreign.nomeUtente
          ? `@${foreign.nomeUtente}`
          : foreign.displayName || 'altro operatore'
        : '';

      const onFocus = () => {
        focusedKeysRef.current.add(fieldKey);
        void claimPmaFieldLock(manifestationId, pazienteDocId, fieldKey, operator).catch(() => {});
      };

      const onBlur = () => {
        focusedKeysRef.current.delete(fieldKey);
        void releasePmaFieldLock(manifestationId, pazienteDocId, fieldKey, operator.uid);
      };

      return {
        isForeign,
        foreignLabel,
        wrapClass: isForeign ? 'ring-2 ring-red-500 ring-offset-1 rounded-md' : '',
        onFocus,
        onBlur,
      };
    },
    [locks, manifestationId, pazienteDocId, operator],
  );

  const value = useMemo(() => ({ useFieldLock }), [useFieldLock]);

  return (
    <PmaFieldPresenceContext.Provider value={value}>{children}</PmaFieldPresenceContext.Provider>
  );
}

export function usePmaFieldPresence() {
  const ctx = useContext(PmaFieldPresenceContext);
  if (!ctx) {
    return {
      useFieldLock: () => ({
        isForeign: false,
        foreignLabel: '',
        wrapClass: '',
        onFocus: () => {},
        onBlur: () => {},
      }),
    };
  }
  return ctx;
}
