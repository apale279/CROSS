async function loadSvgDimensionsFromText(svgText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');
  const svg = doc.querySelector('svg');
  if (!svg) throw new Error('SVG non valido');

  const viewBox = svg.getAttribute('viewBox');
  if (viewBox) {
    const parts = viewBox.trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n) && n > 0)) {
      return { width: parts[2], height: parts[3] };
    }
  }

  const w = Number.parseFloat(svg.getAttribute('width'));
  const h = Number.parseFloat(svg.getAttribute('height'));
  if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
    return { width: w, height: h };
  }

  return { width: 1000, height: 1000 };
}

async function loadSvgDimensions(url) {
  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) throw new Error('Impossibile caricare la piantina SVG');
  const text = await res.text();
  return loadSvgDimensionsFromText(text);
}

/** Carica dimensioni naturali (PNG/JPG/WebP/SVG) per bounds Leaflet CRS.Simple. */
export function loadImageDimensions(url) {
  const u = (url ?? '').trim().toLowerCase();
  const isSvg = u.includes('.svg') || u.startsWith('data:image/svg+xml');

  if (isSvg) {
    return loadSvgDimensions(url);
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      if (!width || !height) {
        reject(new Error('Impossibile leggere le dimensioni della piantina'));
        return;
      }
      resolve({ width, height });
    };
    img.onerror = () => reject(new Error('Impossibile caricare la piantina'));
    img.crossOrigin = 'anonymous';
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

/** Posizione % sulla piantina tattica (non sovrascrive luogo_fisico né coordinate geo). */
export function eventoOnTacticalBoard(evento) {
  return parseCoordinateStazionamento(evento?.coordinate_piantina) != null;
}
