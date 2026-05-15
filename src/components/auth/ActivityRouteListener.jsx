import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/** Registra su Firestore ogni cambio di percorso (utente autenticato). */
export function ActivityRouteListener() {
  const location = useLocation();
  const { user, logActivity } = useAuth();
  const prevPath = useRef(null);

  useEffect(() => {
    if (!user) return;
    const full = `${location.pathname}${location.search}`;
    if (prevPath.current === full) return;
    prevPath.current = full;
    void logActivity('PAGE_VIEW', full);
  }, [location.pathname, location.search, user, logActivity]);

  return null;
}
