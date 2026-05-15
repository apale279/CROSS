import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { GOOGLE_MAPS_API_KEY } from '../constants';
import { loadGoogleMaps } from '../lib/googleMaps';

const GoogleMapsContext = createContext({
  isLoaded: false,
  loadError: null,
});

export function useGoogleMapsReady() {
  return useContext(GoogleMapsContext);
}

/**
 * Sincronizza lo stato di caricamento Maps senza bloccare il rendering delle pagine
 * (Impostazioni, ecc.). Lo script è iniettato una sola volta da loadGoogleMaps().
 */
export function GoogleMapsProvider({ children }) {
  const [isLoaded, setIsLoaded] = useState(
    () => typeof window !== 'undefined' && Boolean(window.google?.maps),
  );
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const key = (GOOGLE_MAPS_API_KEY ?? '').trim();
    if (!key) {
      setLoadError(new Error('VITE_GOOGLE_MAPS_API_KEY mancante in .env.local'));
      setIsLoaded(false);
      return undefined;
    }

    loadGoogleMaps()
      .then(() => {
        if (!cancelled) {
          setIsLoaded(true);
          setLoadError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setIsLoaded(false);
          setLoadError(err);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(() => ({ isLoaded, loadError }), [isLoaded, loadError]);

  return <GoogleMapsContext.Provider value={value}>{children}</GoogleMapsContext.Provider>;
}
