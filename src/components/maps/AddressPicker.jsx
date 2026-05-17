import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useGoogleMapsReady } from '../../context/GoogleMapsContext';
import { useManifestazione } from '../../hooks/useManifestazione';
import { geocodeAddress, loadGoogleMaps, parseCoordinate } from '../../lib/googleMaps';
import { FormField, btnSecondary, inputClass } from '../ui/FormField';
import { LocationMap } from './LocationMap';

const ADDRESS_DEBOUNCE_MS = 600;
const MIN_QUERY_LENGTH = 2;

export function AddressPicker({ indirizzo, coordinate, onCommit, mapAreaHint }) {
  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;

  const { manifestazione } = useManifestazione();
  const fallbackCenter =
    (mapAreaHint ?? manifestazione?.luogo)?.trim() || '';
  const { isLoaded: mapsApiReady, loadError: mapsLoadError } = useGoogleMapsReady();
  const [inputValue, setInputValue] = useState(indirizzo ?? '');
  const [ready, setReady] = useState(false);
  const [autocompleteError, setAutocompleteError] = useState(false);
  const [predictions, setPredictions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showCoords, setShowCoords] = useState(false);
  const [mapPick, setMapPick] = useState(false);
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [refreshingGeo, setRefreshingGeo] = useState(false);
  const lastExternal = useRef('');

  const autocompleteServiceRef = useRef(null);
  const placesServiceRef = useRef(null);
  const sessionTokenRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const requestIdRef = useRef(0);

  const commit = useCallback((payload) => {
    if (payload.indirizzo != null) {
      setInputValue(payload.indirizzo);
    }
    if (payload.coordinate) {
      setLat(String(payload.coordinate.lat));
      setLng(String(payload.coordinate.lng));
    }
    setShowSuggestions(false);
    setPredictions([]);
    commitRef.current?.(payload);
  }, []);

  useEffect(() => {
    const key = JSON.stringify({ indirizzo, coordinate });
    if (key === lastExternal.current) return;
    lastExternal.current = key;

    setInputValue(indirizzo ?? '');
    const c = parseCoordinate(coordinate);
    setLat(c ? String(c.lat) : '');
    setLng(c ? String(c.lng) : '');
  }, [indirizzo, coordinate]);

  useEffect(() => {
    if (!mapsApiReady) return undefined;
    let cancelled = false;

    loadGoogleMaps()
      .then((maps) => {
        if (cancelled) return;
        autocompleteServiceRef.current = new maps.places.AutocompleteService();
        placesServiceRef.current = new maps.places.PlacesService(document.createElement('div'));
        setReady(true);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setAutocompleteError(true);
      });

    return () => {
      cancelled = true;
      autocompleteServiceRef.current = null;
      placesServiceRef.current = null;
    };
  }, [mapsApiReady]);

  useEffect(
    () => () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    },
    [],
  );

  const fetchPredictions = useCallback((query) => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < MIN_QUERY_LENGTH || !autocompleteServiceRef.current) {
      setPredictions([]);
      setLoadingSuggestions(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    setLoadingSuggestions(true);

    const maps = window.google?.maps;
    if (!maps?.places) {
      setLoadingSuggestions(false);
      return;
    }

    if (!sessionTokenRef.current) {
      sessionTokenRef.current = new maps.places.AutocompleteSessionToken();
    }

    autocompleteServiceRef.current.getPlacePredictions(
      {
        input: trimmed,
        componentRestrictions: { country: 'it' },
        types: ['address', 'geocode', 'establishment'],
        sessionToken: sessionTokenRef.current,
      },
      (results, status) => {
        if (requestId !== requestIdRef.current) return;
        setLoadingSuggestions(false);
        if (status === maps.places.PlacesServiceStatus.OK && results?.length) {
          setPredictions(results);
          setShowSuggestions(true);
        } else {
          setPredictions([]);
        }
      },
    );
  }, []);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputValue(value);
    setShowSuggestions(false);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    if (!value.trim() || value.trim().length < MIN_QUERY_LENGTH) {
      setPredictions([]);
      setLoadingSuggestions(false);
      requestIdRef.current += 1;
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      fetchPredictions(value);
    }, ADDRESS_DEBOUNCE_MS);
  };

  const selectPrediction = (prediction) => {
    if (!placesServiceRef.current || !window.google?.maps?.places) return;

    setShowSuggestions(false);
    setPredictions([]);
    setLoadingSuggestions(false);

    const token = sessionTokenRef.current;
    sessionTokenRef.current = null;

    placesServiceRef.current.getDetails(
      {
        placeId: prediction.place_id,
        fields: ['formatted_address', 'geometry', 'name'],
        sessionToken: token,
      },
      (place, status) => {
        const maps = window.google.maps;
        if (status !== maps.places.PlacesServiceStatus.OK || !place?.geometry?.location) {
          setInputValue(prediction.description);
          return;
        }
        const loc = place.geometry.location;
        const addr = place.formatted_address ?? place.name ?? prediction.description;
        commit({
          indirizzo: addr,
          coordinate: { lat: loc.lat(), lng: loc.lng() },
        });
      },
    );
  };

  const handleBlur = async () => {
    setTimeout(() => setShowSuggestions(false), 150);

    const trimmed = inputValue.trim();
    if (!trimmed) return;

    const existing = parseCoordinate(coordinate);
    if (existing) return;

    try {
      const maps = await loadGoogleMaps();
      const result = await geocodeAddress(maps, trimmed);
      if (result) commit(result);
    } catch (err) {
      console.error(err);
    }
  };

  const refreshFromAddress = async () => {
    const trimmed = inputValue.trim();
    const mapsBroken = mapsLoadError || autocompleteError;
    if (!trimmed || !ready || mapsBroken) return;
    setRefreshingGeo(true);
    try {
      const maps = await loadGoogleMaps();
      const result = await geocodeAddress(maps, trimmed);
      if (result) {
        commit(result);
      } else {
        alert('Indirizzo non trovato: prova a selezionare un suggerimento o riformula.');
      }
    } catch (err) {
      console.error(err);
      alert('Impossibile aggiornare le coordinate: ' + (err?.message ?? err));
    } finally {
      setRefreshingGeo(false);
    }
  };

  const commitCoords = () => {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) return;
    commit({
      indirizzo: inputValue.trim(),
      coordinate: { lat: latitude, lng: longitude },
    });
  };

  const reverseFromCoords = async () => {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) return;
    const maps = await loadGoogleMaps();
    const geocoder = new maps.Geocoder();
    geocoder.geocode({ location: { lat: latitude, lng: longitude } }, (results, status) => {
      const addr =
        status === 'OK' && results[0]
          ? results[0].formatted_address
          : inputValue.trim();
      commit({
        indirizzo: addr,
        coordinate: { lat: latitude, lng: longitude },
      });
    });
  };

  const mapCoord =
    parseCoordinate(coordinate) ??
    (lat && lng && !Number.isNaN(parseFloat(lat)) && !Number.isNaN(parseFloat(lng))
      ? { lat: parseFloat(lat), lng: parseFloat(lng) }
      : null);

  const loadError = mapsLoadError || autocompleteError;
  const placeholder = loadError
    ? 'Mappa non disponibile — verifica API Google'
    : ready
      ? 'Inizia a digitare l\'indirizzo…'
      : 'Caricamento suggerimenti…';

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
      <FormField label="Indirizzo (opzionale)">
        <div className="flex gap-1.5">
          <div className="relative min-w-0 flex-1">
          <input
            type="text"
            className={inputClass}
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleBlur}
            onFocus={() => {
              if (predictions.length > 0) setShowSuggestions(true);
            }}
            placeholder={placeholder}
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={showSuggestions && predictions.length > 0}
          />
          {showSuggestions && predictions.length > 0 && (
            <ul
              className="absolute z-[10060] mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
              role="listbox"
            >
              {predictions.map((p) => (
                <li key={p.place_id} role="option">
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-sky-50"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectPrediction(p)}
                  >
                    {p.description}
                  </button>
                </li>
              ))}
            </ul>
          )}
          </div>
          <button
            type="button"
            title="Aggiorna coordinate dall’indirizzo (geocodifica)"
            disabled={!ready || !!loadError || !inputValue.trim() || refreshingGeo}
            className="shrink-0 rounded-md border border-slate-300 bg-white p-1.5 text-slate-600 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={(e) => {
              e.preventDefault();
              refreshFromAddress();
            }}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshingGeo ? 'animate-spin' : ''}`} />
          </button>
        </div>
        {ready && !loadError && (
          <p className="mt-1 text-xs text-slate-500">
            Suggerimenti dopo {ADDRESS_DEBOUNCE_MS / 1000}s senza digitare; la mappa si aggiorna
            alla selezione. Usa il pulsante accanto per ricalcolare le coordinate se modifichi
            l’indirizzo a mano.
            {loadingSuggestions && ' Ricerca…'}
          </p>
        )}
      </FormField>

      {mapCoord && (
        <p className="font-mono text-xs text-slate-600">
          Coordinate: {mapCoord.lat.toFixed(6)}, {mapCoord.lng.toFixed(6)}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`${btnSecondary} shrink-0 px-2 py-1.5 text-xs ${showCoords ? 'border-sky-500 bg-sky-50' : ''}`}
          onClick={() => {
            setShowCoords((v) => !v);
            if (!showCoords) setMapPick(false);
          }}
        >
          Coordinate manuali
        </button>
        <button
          type="button"
          className={`${btnSecondary} shrink-0 px-2 py-1.5 text-xs ${mapPick ? 'border-sky-500 bg-sky-50' : ''}`}
          onClick={() => {
            setMapPick((v) => !v);
            if (!mapPick) setShowCoords(false);
          }}
        >
          {mapPick ? 'Fine da mappa' : 'Da mappa'}
        </button>
      </div>

      {showCoords && (
        <div className="grid grid-cols-2 gap-3 rounded border border-slate-200 bg-white p-3">
          <FormField label="Latitudine">
            <input
              type="number"
              step="any"
              className={inputClass}
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              onBlur={commitCoords}
            />
          </FormField>
          <FormField label="Longitudine">
            <input
              type="number"
              step="any"
              className={inputClass}
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              onBlur={commitCoords}
            />
          </FormField>
          <button
            type="button"
            className={`${btnSecondary} col-span-2 text-xs`}
            onClick={reverseFromCoords}
          >
            Indirizzo da coordinate
          </button>
        </div>
      )}

      {mapsApiReady && (
        <LocationMap
          coordinate={mapCoord}
          onLocationChange={mapPick ? commit : undefined}
          height="280px"
          fallbackCenterAddress={fallbackCenter}
          showSearch={false}
          showPickButton={false}
          pickMode={mapPick}
        />
      )}

      {mapPick && (
        <p className="text-xs text-amber-800">
          Modalità mappa attiva: clicca sul punto o trascina il pin per aggiornare indirizzo e
          coordinate.
        </p>
      )}
    </div>
  );
}
