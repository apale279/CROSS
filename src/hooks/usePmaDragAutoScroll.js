import { useEffect } from 'react';
import { bindPmaDragAutoScroll } from '../lib/pmaDragAutoScroll';

/** Abilita scroll (rotella + bordi) durante drag paziente sulla dashboard PMA. */
export function usePmaDragAutoScroll(enabled) {
  useEffect(() => {
    if (!enabled) return undefined;
    return bindPmaDragAutoScroll();
  }, [enabled]);
}
