import { GOOGLE_MAPS_API_KEY } from '../constants';

export const SCRIPT_ID = 'cross-google-maps-script';

let mapsPromise = null;

/**
 * Carica una sola volta lo script Maps + Places (stessa chiave ovunque).
 */
export function loadGoogleMaps() {
  const key = (GOOGLE_MAPS_API_KEY ?? '').trim();
  if (!key) {
    return Promise.reject(
      new Error('Chiave Google Maps assente: imposta VITE_GOOGLE_MAPS_API_KEY in .env.local'),
    );
  }

  if (window.google?.maps) {
    return Promise.resolve(window.google.maps);
  }

  if (!mapsPromise) {
    mapsPromise = new Promise((resolve, reject) => {
      const finish = () => {
        if (window.google?.maps) {
          resolve(window.google.maps);
        } else {
          mapsPromise = null;
          reject(new Error('Google Maps non disponibile dopo il caricamento dello script'));
        }
      };

      const existing = document.getElementById(SCRIPT_ID);
      if (existing) {
        if (window.google?.maps) {
          finish();
          return;
        }
        const onScriptLoad = () => finish();
        existing.addEventListener('load', onScriptLoad);
        existing.addEventListener('error', () => {
          mapsPromise = null;
          reject(new Error('Errore caricamento script Google Maps'));
        });
        const poll = window.setInterval(() => {
          if (window.google?.maps) {
            window.clearInterval(poll);
            existing.removeEventListener('load', onScriptLoad);
            finish();
          }
        }, 50);
        window.setTimeout(() => {
          window.clearInterval(poll);
          existing.removeEventListener('load', onScriptLoad);
          if (window.google?.maps) {
            finish();
          } else {
            mapsPromise = null;
            reject(new Error('Timeout caricamento Google Maps'));
          }
        }, 60000);
        return;
      }

      const script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&language=it&region=IT`;
      script.async = true;
      script.onload = () => finish();
      script.onerror = () => {
        mapsPromise = null;
        reject(new Error('Impossibile caricare Google Maps'));
      };
      document.head.appendChild(script);
    });
  }

  return mapsPromise;
}

export const DEFAULT_MAP_CENTER = { lat: 41.9028, lng: 12.4964 };

export function parseCoordinate(coordinate) {
  if (!coordinate) return null;
  const lat =
    typeof coordinate.lat === 'number' ? coordinate.lat : parseFloat(coordinate.lat);
  const lng =
    typeof coordinate.lng === 'number' ? coordinate.lng : parseFloat(coordinate.lng);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return { lat, lng };
}

export function coloreToMarker(colore) {
  const map = {
    Bianco: '#f8fafc',
    Verde: '#22c55e',
    Giallo: '#eab308',
    Rosso: '#ef4444',
  };
  return map[colore] ?? map.Bianco;
}

export async function reverseGeocode(maps, lat, lng) {
  const geocoder = new maps.Geocoder();
  return new Promise((resolve) => {
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === 'OK' && results?.[0]) {
        resolve(results[0].formatted_address);
      } else {
        resolve(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      }
    });
  });
}

export async function geocodeAddress(maps, address) {
  if (!address?.trim()) return null;
  const geocoder = new maps.Geocoder();
  return new Promise((resolve) => {
    geocoder.geocode({ address }, (results, status) => {
      if (status === 'OK' && results?.[0]?.geometry?.location) {
        const loc = results[0].geometry.location;
        resolve({
          indirizzo: results[0].formatted_address,
          coordinate: { lat: loc.lat(), lng: loc.lng() },
        });
      } else {
        resolve(null);
      }
    });
  });
}
