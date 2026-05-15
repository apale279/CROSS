import { useEffect, useMemo } from 'react';
import { GoogleMap, Marker, useGoogleMap } from '@react-google-maps/api';
import { useGoogleMapsReady } from '../../context/GoogleMapsContext';
import { useImpostazioni } from '../../hooks/useImpostazioni';
import {
  DEFAULT_MAP_CENTER,
  dashboardMapDefaultFromImpostazioni,
  parseCoordinate,
} from '../../lib/googleMaps';
import { coloreHex } from '../../utils/formatters';

const mapOptions = {
  disableDefaultUI: false,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: true,
};

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

export function OpsMap({ eventi, mezzi, onSelect }) {
  const { isLoaded, loadError } = useGoogleMapsReady();

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
      const pos = parseCoordinate(m.stazionamento?.coordinate);
      if (pos) list.push({ pos, type: 'mezzo', data: m, color: '#0284c7' });
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
  }, [eventi, mezzi, impostazioni]);

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
    <GoogleMap
      mapContainerClassName="h-full w-full"
      center={center}
      zoom={zoom}
      options={mapOptions}
    >
      {eventPositions.length > 0 && <FitEventBounds eventPositions={eventPositions} />}
      {markers.map((m) => {
        const key =
          m.type === 'evento' ? `e-${m.data._docId}` : `z-${m.data.sigla ?? m.data._docId}`;
        const label = m.type === 'evento' ? m.data.idEvento : (m.data.sigla ?? m.data._docId);
        return (
          <Marker
            key={key}
            position={m.pos}
            title={label}
            onClick={() => onSelect?.({ type: m.type, data: m.data })}
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
                : {
                    path: window.google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
                    scale: 6,
                    fillColor: '#0284c7',
                    fillOpacity: 1,
                    strokeColor: '#0c4a6e',
                    strokeWeight: 1,
                  }
            }
          />
        );
      })}
    </GoogleMap>
  );
}
