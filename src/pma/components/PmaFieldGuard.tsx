import type { ReactNode } from 'react';
import { usePmaFieldPresence } from '../context/PmaFieldPresenceContext';

type Props = {
  fieldKey: string;
  children: ReactNode;
  className?: string;
};

/** Contorno rosso se un altro operatore sta modificando lo stesso campo. */
export function PmaFieldGuard({ fieldKey, children, className = '' }: Props) {
  const { useFieldLock } = usePmaFieldPresence();
  const lock = useFieldLock(fieldKey);

  return (
    <div
      className={`${className} ${lock.wrapClass}`.trim()}
      onFocusCapture={lock.onFocus}
      onBlurCapture={lock.onBlur}
    >
      {lock.isForeign && (
        <p className="mb-1 text-xs font-semibold text-red-700">
          In modifica da {lock.foreignLabel} — attendi o coordina prima di salvare
        </p>
      )}
      {children}
    </div>
  );
}
