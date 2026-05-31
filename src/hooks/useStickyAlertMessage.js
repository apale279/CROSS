import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_MIN_MS = 8000;

/**
 * Messaggio banner con tempo minimo di visualizzazione (evita flash illeggibili).
 */
export function useStickyAlertMessage({ minDisplayMs = DEFAULT_MIN_MS } = {}) {
  const [message, setMessageState] = useState(null);
  const shownAtRef = useRef(0);
  const messageRef = useRef(null);
  const timerRef = useRef(null);
  messageRef.current = message;

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    clearTimer();
    setMessageState(null);
  }, [clearTimer]);

  const show = useCallback(
    (msg) => {
      clearTimer();
      const text = String(msg ?? '').trim();
      if (!text) {
        setMessageState(null);
        return;
      }
      shownAtRef.current = Date.now();
      setMessageState(text);
    },
    [clearTimer],
  );

  /** Azzera solo dopo il tempo minimo dall’ultimo `show`. */
  const clearAfterMinDisplay = useCallback(() => {
    if (!messageRef.current) return;
    const elapsed = Date.now() - shownAtRef.current;
    const remaining = minDisplayMs - elapsed;
    clearTimer();
    if (remaining <= 0) {
      setMessageState(null);
      return;
    }
    timerRef.current = setTimeout(() => setMessageState(null), remaining);
  }, [clearTimer, minDisplayMs]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  return { message, show, dismiss, clearAfterMinDisplay };
}
