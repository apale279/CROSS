import { useEffect, useMemo, useState } from 'react';
import { Map, MapPinned } from 'lucide-react';
import { GoogleMap, Marker, useGoogleMap } from '@react-google-maps/api';
import { useGoogleMapsReady } from '../../context/GoogleMapsContext';
import { useImpostazioni } from '../../hooks/useImpostazioni';
import {
  DEFAULT_MAP_CENTER,
  dashboardMapDefaultFromImpostazioni,
  parseCoordinate,
} from '../../lib/googleMaps';
import { coloreHex } from '../../utils/formatters';
import { getEmojiMarkerIcon } from '../../lib/mapMarkers';
import { mezzoMapCoordinate, mezzoMapUsesPosizioneReale } from '../../lib/mezzoPosizione';
import { mezziConMissioneAttiva, mezzoIsOnMissioneAttiva } from '../../lib/mezzoMissione';
import { emojiForTipoMezzo, normalizeTipiMezzo } from '../../lib/tipiMezzo';
import {
  OPS_MAP_VIEW_STANDARD,
  OPS_MAP_VIEW_STREET,
  opsMapOptionsForView,
  persistOpsMapViewMode,
  readOpsMapViewMode,
} from '../../lib/opsMapView';

const baseMapOptions = {
  disableDefaultUI: false,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: true,
};

const readOnlyMapOptions = {
  ...baseMapOptions,
  fullscreenControl: false,
  zoomControl: true,
  draggable: true,
  scrollwheel: true,
  disableDoubleClickZoom: false,
  keyboardShortcuts: false,
};

function ApplyMapViewOptions({ viewMode }) {
  const map = useGoogleMap();

  useEffect(() => {
    if (!map || !window.google?.maps) return;
    const base = { mapTypeControl: false, streetViewControl: false };
    const next = opsMapOptionsForView(base, viewMode);
    map.setOptions(next);
  }, [map, viewMode]);

  return null;
}

function FitEventBounds({ eventPositions }) {
  const map = useGoogleMap();

  useEffect(() => {
    if (!map || !window.google?.maps || eventPositions.length === 0) return;

    if (eventPositions.length === 1) {
      map.setCenter(eventPositions[0]);
      map.setZoom(15);
      return;
    }

    const bounds = new window.google.maps.LatLngBounds();
    eventPositions.forEach((pos) => bounds.extend(pos));
    map.fitBounds(bounds, { top: 48, right: 48, bottom: 48, left: 48 });
  }, [map, eventPositions]);

  return null;
}

const viewToggleBtn =
  'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors';

export function OpsMap({ eventi, mezzi, missioni = [], onSelect, readOnly = false }) {
  const { isLoaded, loadError } = useGoogleMapsReady();
  const { impostazioni } = useImpostazioni();
  const [viewMode, setViewMode] = useState(readOpsMapViewMode);

  const selectViewMode = (mode) => {
    setViewMode(mode);
    persistOpsMapViewMode(mode);
  };

  const mapOptions = useMemo(
    () => opsMapOptionsForView(readOnly ? readOnlyMapOptions : baseMapOptions, viewMode),
    [readOnly, viewMode],
  );
  const tipiMezzo = useMemo(
    () => normalizeTipiMezzo(impostazioni.tipiMezzo),
    [impostazioni.tipiMezzo],
  );
  const mezziInMissione = useMemo(() => mezziConMissioneAttiva(missioni), [missioni]);

  const { center, zoom, markers, eventPositions } = useMemo(() => {
    const list = [];
    const eventOnly = [];

    eventi.forEach((ev) => {
      const pos = parseCoordinate(ev.coordinate);
      if (pos) {
        list.push({ pos, type: 'evento', data: ev, color: coloreHex(ev.colore) });
        eventOnly.push(pos);
      }
    });
    mezzi.forEach((m) => {
      const onMission = mezzoIsOnMissioneAttiva(m, mezziInMissione);
      const pos = mezzoMapCoordinate(m, onMission);
      if (pos) {
        list.push({
          pos,
          type: 'mezzo',
          data: m,
          emoji: emojiForTipoMezzo(m.tipo, tipiMezzo),
          onMission,
          usesGps: mezzoMapUsesPosizioneReale(m, onMission),
        });
      }
    });

    if (eventOnly.length === 0) {
      const custom = dashboardMapDefaultFromImpostazioni(impostazioni);
      return {
        center: custom?.center ?? DEFAULT_MAP_CENTER,
        zoom: custom?.zoom ?? 12,
        markers: list,
        eventPositions: [],
      };
    }

    if (eventOnly.length === 1) {
      return {
        center: eventOnly[0],
        zoom: 15,
        markers: list,
        eventPositions: eventOnly,
      };
    }

    const lat = eventOnly.reduce((s, p) => s + p.lat, 0) / eventOnly.length;
    const lng = eventOnly.reduce((s, p) => s + p.lng, 0) / eventOnly.length;
    return {
      center: { lat, lng },
      zoom: 13,
      markers: list,
      eventPositions: eventOnly,
    };
  }, [eventi, mezzi, mezziInMissione, impostazioni, tipiMezzo]);

  if (loadError) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-100 p-4 text-center text-sm text-red-700">
        Mappa non disponibile: verifica VITE_GOOGLE_MAPS_API_KEY in .env.local e le API Maps
        JavaScript + Places su Google Cloud.
      </div>
    );
  }

  if (!isLoaded) {
    return <div className="h-full w-full bg-slate-200" />;
  }

  return (
    <div className="relative h-full w-full">
      <div
        className="pointer-events-none absolute right-2 top-2 z-10 flex rounded-lg border border-slate-200/90 bg-white/95 p-0.5 shadow-md backdrop-blur-sm"
        role="group"
        aria-label="Tipo vista mappa"
      >
        <button
          type="button"
          className={`pointer-events-auto ${viewToggleBtn} ${
            viewMode === OPS_MAP_VIEW_STANDARD
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
          aria-pressed={viewMode === OPS_MAP_VIEW_STANDARD}
          onClick={() => selectViewMode(OPS_MAP_VIEW_STANDARD)}
        >
          <Map className="h-3.5 w-3.5 shrink-0" />
          Standard
        </button>
        <button
          type="button"
          className={`pointer-events-auto ${viewToggleBtn} ${
            viewMode === OPS_MAP_VIEW_STREET
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
          aria-pressed={viewMode === OPS_MAP_VIEW_STREET}
          onClick={() => selectViewMode(OPS_MAP_VIEW_STREET)}
        >
          <MapPinned className="h-3.5 w-3.5 shrink-0" />
          Solo strade
        </button>
      </div>

      <GoogleMap
        mapContainerClassName="h-full w-full"
        center={center}
        zoom={zoom}
        options={mapOptions}
      >
        <ApplyMapViewOptions viewMode={viewMode} />
        {eventPositions.length > 0 && <FitEventBounds eventPositions={eventPositions} />}
      {markers.map((m) => {
        const key =
          m.type === 'evento' ? `e-${m.data._docId}` : `z-${m.data.sigla ?? m.data._docId}`;
        const label = m.type === 'evento' ? m.data.idEvento : (m.data.sigla ?? m.data._docId);
        const title =
          m.type === 'mezzo' && m.usesGps
            ? `${label} · pos. GPS`
            : m.type === 'mezzo' && m.onMission
              ? `${label} · in missione`
              : label;
        return (
          <Marker
            key={key}
            position={m.pos}
            title={title}
            clickable={Boolean(onSelect)}
            onClick={onSelect ? () => onSelect({ type: m.type, data: m.data }) : undefined}
            icon={
              m.type === 'evento'
                ? {
                    path: window.google.maps.SymbolPath.CIRCLE,
                    scale: 11,
                    fillColor: m.color,
                    fillOpacity: 1,
                    strokeColor: '#1e293b',
                    strokeWeight: 2,
                  }
                : getEmojiMarkerIcon(window.google, m.emoji)
            }
          />
        );
      })}
      </GoogleMap>
    </div>
  );
}
