import { useMemo } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';

/**
 * Sola lettura: query `mode=readonly` oppure rotte /kiosk/* (monitor esterni).
 */
export function useReadOnlyMode() {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();

  return useMemo(() => {
    if (pathname.startsWith('/kiosk')) return true;
    return searchParams.get('mode') === 'readonly';
  }, [pathname, searchParams]);
}
