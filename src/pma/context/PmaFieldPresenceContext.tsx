import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';

/** Lock presenza disattivato: cartella clinica multi-operatore usa merge transazionale. */

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
  children,
}: ProviderProps) {
  const useFieldLock = useCallback(() => {
    return {
      isForeign: false,
      foreignLabel: '',
      wrapClass: '',
      onFocus: () => {},
      onBlur: () => {},
    };
  }, []);

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
