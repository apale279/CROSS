/** Carica dimensioni naturali di un'immagine (per bounds Leaflet CRS.Simple). */
export function loadImageDimensions(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };
    img.onerror = () => reject(new Error('Impossibile caricare la piantina'));
    img.src = url;
  });
}

/** Bounds Leaflet: [[0,0], [altezza, larghezza]] — lat = y, lng = x. */
export function imageBoundsFromDimensions({ width, height }) {
  return [
    [0, 0],
    [height, width],
  ];
}

export function parseCoordinateStazionamento(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const x = Number(raw.x);
  const y = Number(raw.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return {
    x: Math.min(100, Math.max(0, x)),
    y: Math.min(100, Math.max(0, y)),
  };
}

export function percentToLatLng(x, y, imageHeight, imageWidth) {
  return {
    lat: (y / 100) * imageHeight,
    lng: (x / 100) * imageWidth,
  };
}

export function latLngToPercent(lat, lng, imageHeight, imageWidth) {
  if (!imageHeight || !imageWidth) return null;
  return {
    x: Math.round((lng / imageWidth) * 1000) / 10,
    y: Math.round((lat / imageHeight) * 1000) / 10,
  };
}

export function formatPercentPosition(coord) {
  const c = parseCoordinateStazionamento(coord);
  if (!c) return null;
  return `Posizione: X: ${c.x}%, Y: ${c.y}%`;
}

export function mezzoOnTacticalBoard(mezzo) {
  return parseCoordinateStazionamento(mezzo?.coordinate_stazionamento) != null;
}
