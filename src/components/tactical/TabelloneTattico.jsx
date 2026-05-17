import { useCallback, useEffect, useMemo, useState } from 'react';
import { deleteField } from 'firebase/firestore';
import L from 'leaflet';
import { MapContainer, ImageOverlay, Marker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useManifestazioneId } from '../../context/ManifestazioneContext';
import { patchEvento } from '../../services/eventiService';
import { patchMezzo } from '../../services/mezziService';
import { siglaInMezziMissione } from '../../lib/mezzoMissione';
import {
  eventoOnTacticalBoard,
  imageBoundsFromDimensions,
  latLngToPercent,
  loadImageDimensions,
  mezzoOnTacticalBoard,
  parseCoordinateStazionamento,
  percentToLatLng,
} from '../../lib/tacticalBoard';
import { EVENTO_DRAG_MIME } from './EventiTatticaSidebar';
import { MEZZO_DRAG_MIME } from './MezziPilaSidebar';

function FitBounds({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (!bounds) return;
    map.fitBounds(bounds, { padding: [16, 16] });
  }, [map, bounds]);
  return null;
}

function MapDropLayer({ imageSize, onDropMezzo, onDropEvento }) {
  const map = useMap();

  useEffect(() => {
    if (!imageSize) return undefined;
    const el = map.getContainer();
    const { height, width } = imageSize;

    const onDragOver = (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    };

    const onDrop = (e) => {
      e.preventDefault();
      const point = map.mouseEventToLatLng(e);
      const pct = latLngToPercent(point.lat, point.lng, height, width);
      if (!pct) return;

      const eventoDocId = e.dataTransfer.getData(EVENTO_DRAG_MIME);
      if (eventoDocId && onDropEvento) {
        onDropEvento(eventoDocId, pct);
        return;
      }

      const sigla = e.dataTransfer.getData(MEZZO_DRAG_MIME);
      if (sigla && onDropMezzo) onDropMezzo(sigla, pct);
    };

    el.addEventListener('dragover', onDragOver);
    el.addEventListener('drop', onDrop);
    return () => {
      el.removeEventListener('dragover', onDragOver);
      el.removeEventListener('drop', onDrop);
    };
  }, [map, imageSize, onDropMezzo, onDropEvento]);

  return null;
}

const MARKER_MIN_W = 34;
const MARKER_MAX_W = 96;
const MARKER_H = 22;

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function markerLayout(sigla) {
  const text = String(sigla);
  const len = Math.max(text.length, 1);
  const fontPx = len <= 6 ? 11 : len <= 10 ? 10 : 9;
  const w = Math.min(
    MARKER_MAX_W,
    Math.max(MARKER_MIN_W, Math.ceil(len * fontPx * 0.62) + 10),
  );
  return { w, h: MARKER_H, fontPx };
}

function isOutsideBoard(lat, lng, height, width) {
  const margin = 4;
  return lat < -margin || lng < -margin || lat > height + margin || lng > width + margin;
}

function coloreEventoSlug(colore) {
  return String(colore ?? 'bianco')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function EventoTacticalMarker({
  evento,
  imageSize,
  onMoved,
  onRemoved,
  onSelect,
  selected,
}) {
  const coord = parseCoordinateStazionamento(evento.coordinate_piantina);
  if (!coord || !imageSize) return null;

  const label = evento.idEvento ?? '?';
  const { lat, lng } = percentToLatLng(coord.x, coord.y, imageSize.height, imageSize.width);
  const { w, h, fontPx } = markerLayout(label);
  const slug = coloreEventoSlug(evento.colore);

  const icon = L.divIcon({
    className: '',
    html: `<div class="cross-evento-marker cross-evento-marker--${slug} ${selected ? 'cross-evento-marker--selected' : ''}" style="--marker-font:${fontPx}px;width:${w}px;height:${h}px"><span>${escapeHtml(label)}</span></div>`,
    iconSize: [w, h],
    iconAnchor: [w / 2, h / 2],
  });

  return (
    <Marker
      position={[lat, lng]}
      icon={icon}
      draggable
      zIndexOffset={400}
      eventHandlers={{
        click: () => onSelect?.(evento),
        dragend: (e) => {
          const { lat: la, lng: ln } = e.target.getLatLng();
          const { height, width } = imageSize;
          if (isOutsideBoard(la, ln, height, width)) {
            onRemoved?.(evento._docId);
            return;
          }
          const pct = latLngToPercent(la, ln, height, width);
          if (pct) onMoved(evento._docId, pct);
        },
      }}
    />
  );
}

function MezzoTacticalMarker({
  mezzo,
  imageSize,
  onMoved,
  onRemoved,
  onSelect,
  selected,
  occupato,
}) {
  const coord = parseCoordinateStazionamento(mezzo.coordinate_stazionamento);
  if (!coord || !imageSize) return null;

  const sigla = mezzo.sigla ?? mezzo._docId;
  const { lat, lng } = percentToLatLng(coord.x, coord.y, imageSize.height, imageSize.width);
  const { w, h, fontPx } = markerLayout(sigla);
  const safeSigla = escapeHtml(sigla);

  const icon = L.divIcon({
    className: '',
    html: `<div class="cross-mezzo-marker ${occupato ? 'cross-mezzo-marker--occupato' : 'cross-mezzo-marker--libero'} ${selected ? 'cross-mezzo-marker--selected' : ''}" style="--marker-font:${fontPx}px;width:${w}px;height:${h}px"><span>${safeSigla}</span></div>`,
    iconSize: [w, h],
    iconAnchor: [w / 2, h / 2],
  });

  return (
    <Marker
      position={[lat, lng]}
      icon={icon}
      draggable
      eventHandlers={{
        click: () => onSelect?.(mezzo),
        dragend: (e) => {
          const { lat: la, lng: ln } = e.target.getLatLng();
          const { height, width } = imageSize;
          if (isOutsideBoard(la, ln, height, width)) {
            onRemoved?.(sigla);
            return;
          }
          const pct = latLngToPercent(la, ln, height, width);
          if (pct) onMoved(sigla, pct);
        },
      }}
    />
  );
}

export function TabelloneTattico({
  piantinaUrl,
  eventi = [],
  mezzi,
  mezziOccupati,
  selectedEventoDocId,
  selectedSigla,
  onSelectEvento,
  onSelectMezzo,
}) {
  const manifestationId = useManifestazioneId();
  const [imageSize, setImageSize] = useState(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!piantinaUrl) {
      setImageSize(null);
      return;
    }
    let cancelled = false;
    setLoadError('');
    loadImageDimensions(piantinaUrl)
      .then((dim) => {
        if (!cancelled) setImageSize(dim);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message ?? 'Errore caricamento');
      });
    return () => {
      cancelled = true;
    };
  }, [piantinaUrl]);

  const bounds = useMemo(
    () => (imageSize ? imageBoundsFromDimensions(imageSize) : null),
    [imageSize],
  );

  const mezziOnBoard = useMemo(() => mezzi.filter(mezzoOnTacticalBoard), [mezzi]);
  const eventiOnBoard = useMemo(
    () => eventi.filter((e) => e.stato !== false && eventoOnTacticalBoard(e)),
    [eventi],
  );

  const placeMezzo = useCallback(
    async (sigla, coordinate_stazionamento) => {
      await patchMezzo(manifestationId, sigla, { coordinate_stazionamento });
    },
    [manifestationId],
  );

  const removeMezzoFromBoard = useCallback(
    async (sigla) => {
      await patchMezzo(manifestationId, sigla, { coordinate_stazionamento: deleteField() });
    },
    [manifestationId],
  );

  const placeEvento = useCallback(
    async (docId, coordinate_piantina) => {
      await patchEvento(manifestationId, docId, { coordinate_piantina });
    },
    [manifestationId],
  );

  const removeEventoFromBoard = useCallback(
    async (docId) => {
      await patchEvento(manifestationId, docId, { coordinate_piantina: deleteField() });
    },
    [manifestationId],
  );

  if (!piantinaUrl) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-100 p-6 text-center text-sm text-slate-600">
        Nessuna piantina configurata. Caricala da Impostazioni → Info luogo.
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center bg-red-50 p-6 text-sm text-red-800">
        {loadError}
      </div>
    );
  }

  if (!bounds || !imageSize) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-100 text-sm text-slate-500">
        Caricamento piantina…
      </div>
    );
  }

  return (
    <MapContainer
      crs={L.CRS.Simple}
      bounds={bounds}
      maxBounds={bounds}
      className="h-full w-full bg-slate-900"
      zoomControl
      attributionControl={false}
      minZoom={-3}
    >
      <ImageOverlay url={piantinaUrl} bounds={bounds} />
      <FitBounds bounds={bounds} />
      <MapDropLayer
        imageSize={imageSize}
        onDropMezzo={placeMezzo}
        onDropEvento={placeEvento}
      />
      {eventiOnBoard.map((ev) => (
        <EventoTacticalMarker
          key={ev._docId}
          evento={ev}
          imageSize={imageSize}
          selected={selectedEventoDocId === ev._docId}
          onSelect={onSelectEvento}
          onMoved={placeEvento}
          onRemoved={removeEventoFromBoard}
        />
      ))}
      {mezziOnBoard.map((m) => {
        const sigla = m.sigla ?? m._docId;
        return (
          <MezzoTacticalMarker
            key={sigla}
            mezzo={m}
            imageSize={imageSize}
            selected={selectedSigla === sigla}
            onSelect={onSelectMezzo}
            onMoved={placeMezzo}
            onRemoved={removeMezzoFromBoard}
            occupato={siglaInMezziMissione(sigla, mezziOccupati)}
          />
        );
      })}
    </MapContainer>
  );
}
