import { useEffect, useRef, useState } from 'react';
import { useGoogleMapsReady } from '../../context/GoogleMapsContext';
import {
  DEFAULT_MAP_CENTER,
  loadGoogleMaps,
  parseCoordinate,
  reverseGeocode,
} from '../../lib/googleMaps';
import { btnPrimary, btnSecondary, inputClass } from '../ui/FormField';

/** Migliora geocoding per città italiane brevi (es. «LECCO»). */
function geocodeQueryFromHint(hint) {
  const t = hint?.trim();
  if (!t) return '';
  return t.includes(',') ? t : `${t}, Italia`;
}

export function LocationMap({
  coordinate,
  onLocationChange,
  height = '280px',
  showPickButton = true,
  geocodeAddress = false,
  indirizzo,
  /** Centro mappa quando non c’è ancora coordinate evento (es. luogo da impostazioni). */
  fallbackCenterAddress,
  showSearch = false,
  defaultPickMode = false,
  pickMode: pickModeProp,
}) {
  const containerRef = useRef(null);
  const searchRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const clickListenerRef = useRef(null);
  const { isLoaded: mapsApiReady, loadError } = useGoogleMapsReady();
  const [pickModeInternal, setPickModeInternal] = useState(defaultPickMode);
  const [mapReady, setMapReady] = useState(false);
  const [searchReady, setSearchReady] = useState(false);

  const pickModeControlled = pickModeProp !== undefined;
  const pickMode = pickModeControlled ? pickModeProp : pickModeInternal;

  useEffect(() => {
    if (!pickModeControlled) setPickModeInternal(defaultPickMode);
  }, [defaultPickMode, pickModeControlled]);

  const placeMarker = (maps, position) => {
    if (!mapRef.current) return;
    if (markerRef.current) {
      markerRef.current.setMap(null);
    }
    markerRef.current = new maps.Marker({
      map: mapRef.current,
      position,
      draggable: pickMode,
    });
    if (pickMode) {
      markerRef.current.addListener('dragend', () => {
        const pos = markerRef.current.getPosition();
        applyPosition(maps, pos.lat(), pos.lng());
      });
    }
  };

  const applyPosition = async (maps, lat, lng) => {
    const addr = await reverseGeocode(maps, lat, lng);
    onLocationChange?.({
      indirizzo: addr,
      coordinate: { lat: Number(lat), lng: Number(lng) },
    });
  };

  const centerOn = (maps, coord, zoom = 16, withMarker = true) => {
    if (!mapRef.current || !coord) return;
    mapRef.current.setCenter(coord);
    mapRef.current.setZoom(zoom);
    if (withMarker) {
      placeMarker(maps, coord);
    } else if (markerRef.current) {
      markerRef.current.setMap(null);
      markerRef.current = null;
    }
  };

  const coord = parseCoordinate(coordinate);
  const coordKey = coord ? `${coord.lat},${coord.lng}` : '';
  const hint = fallbackCenterAddress?.trim();
  const needsMap = Boolean(coord) || pickMode || Boolean(hint);

  useEffect(() => {
    if (!mapsApiReady || !needsMap) {
      if (!needsMap) {
        setMapReady(false);
        if (markerRef.current) {
          markerRef.current.setMap(null);
          markerRef.current = null;
        }
        mapRef.current = null;
      }
      return undefined;
    }
    let cancelled = false;
    loadGoogleMaps().then((maps) => {
      if (cancelled || !containerRef.current) return;
      if (!mapRef.current) {
        mapRef.current = new maps.Map(containerRef.current, {
          center: coord ?? DEFAULT_MAP_CENTER,
          zoom: coord ? 16 : hint ? 12 : 12,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        });
      }
      setMapReady(true);
      if (coord) centerOn(maps, coord);
    });
    return () => {
      cancelled = true;
    };
  }, [mapsApiReady, needsMap, coordKey, hint]);

  useEffect(() => {
    if (!mapReady || !showSearch || !searchRef.current) return undefined;
    let autocomplete;
    loadGoogleMaps().then((maps) => {
      autocomplete = new maps.places.Autocomplete(searchRef.current, {
        fields: ['formatted_address', 'geometry'],
      });
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        const loc = place.geometry?.location;
        if (!loc || !mapRef.current) return;
        const coord = { lat: loc.lat(), lng: loc.lng() };
        centerOn(maps, coord, 14);
        if (pickMode) {
          applyPosition(maps, coord.lat, coord.lng);
        } else {
          onLocationChange?.({
            indirizzo: place.formatted_address ?? searchRef.current.value,
            coordinate: coord,
          });
        }
      });
      setSearchReady(true);
    });
    return () => {
      if (autocomplete && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(autocomplete);
      }
    };
  }, [mapReady, showSearch, pickMode]);

  useEffect(() => {
    if (!mapReady || !coord) return;
    loadGoogleMaps().then((maps) => centerOn(maps, coord));
  }, [mapReady, coordKey]);

  /** Vista area senza pin quando l’evento non ha ancora coordinate. */
  useEffect(() => {
    if (!mapReady || coord || pickMode) return;
    const q = geocodeQueryFromHint(hint);
    if (!q) return;

    let cancelled = false;
    loadGoogleMaps().then((maps) => {
      const geocoder = new maps.Geocoder();
      geocoder.geocode({ address: q }, (results, status) => {
        if (cancelled || !mapRef.current) return;
        if (status === 'OK' && results?.[0]?.geometry?.location) {
          const loc = results[0].geometry.location;
          centerOn(maps, { lat: loc.lat(), lng: loc.lng() }, 12, false);
        }
      });
    });
    return () => {
      cancelled = true;
    };
  }, [mapReady, coordKey, pickMode, hint]);

  useEffect(() => {
    if (!mapReady) return;
    loadGoogleMaps().then((maps) => {
      if (clickListenerRef.current) {
        window.google.maps.event.removeListener(clickListenerRef.current);
        clickListenerRef.current = null;
      }
      if (pickMode && mapRef.current) {
        mapRef.current.setOptions({ draggableCursor: 'crosshair' });
        clickListenerRef.current = mapRef.current.addListener('click', (e) => {
          const lat = e.latLng.lat();
          const lng = e.latLng.lng();
          placeMarker(maps, { lat, lng });
          applyPosition(maps, lat, lng);
        });
        if (markerRef.current) {
          markerRef.current.setDraggable(true);
        }
      } else if (mapRef.current) {
        mapRef.current.setOptions({ draggableCursor: null });
        if (markerRef.current) markerRef.current.setDraggable(false);
      }
    });
    return () => {
      if (clickListenerRef.current) {
        window.google?.maps?.event?.removeListener(clickListenerRef.current);
      }
    };
  }, [pickMode, mapReady]);

  return (
    <div className="space-y-2">
      {showSearch && (
        <input
          ref={searchRef}
          type="text"
          className={inputClass}
          placeholder={searchReady ? 'Cerca luogo sulla mappa…' : 'Caricamento ricerca…'}
        />
      )}
      {showPickButton && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={pickMode ? btnPrimary : btnSecondary}
            onClick={() => setPickModeInternal((v) => !v)}
          >
            {pickMode ? 'Fine acquisizione' : 'Acquisisci da mappa'}
          </button>
          {pickMode && (
            <span className="self-center text-xs text-amber-700">
              Clicca sulla mappa o trascina il pin
            </span>
          )}
        </div>
      )}
      <div
        ref={containerRef}
        className={`w-full overflow-hidden rounded-lg border border-slate-300 ${
          needsMap ? 'bg-slate-100' : 'flex items-center justify-center bg-slate-50'
        } ${pickMode ? 'ring-2 ring-sky-500' : ''}`}
        style={{ height }}
      >
        {!needsMap && (
          <p className="px-4 text-center text-xs text-slate-500">
            Imposta il luogo dell&apos;operazione (impostazioni o indirizzo evento): il punto comparirà sulla
            mappa.
          </p>
        )}
      </div>
      {loadError && needsMap && (
        <p className="text-center text-xs text-red-600">Mappa non disponibile (chiave Maps).</p>
      )}
      {!loadError && needsMap && !mapReady && (
        <p className="text-center text-xs text-slate-500">Caricamento mappa…</p>
      )}
    </div>
  );
}
