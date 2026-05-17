import { parseCoordinate } from './googleMaps';

/** Coordinate GPS reali del mezzo (Telegram), se presenti. */
export function mezzoPosizioneRealeCoordinate(mezzo) {
  return parseCoordinate(mezzo?.posizioneReale?.coordinate);
}

/**
 * Coordinate per mappa operativa.
 * - In missione attiva: posizione reale GPS (Telegram), altrimenti stazionamento.
 * - Senza missione: solo stazionamento.
 */
export function mezzoMapCoordinate(mezzo, onMission = false, gpsTrackingEnabled = true) {
  const stazionamento = parseCoordinate(mezzo?.stazionamento?.coordinate);
  const posizioneReale = gpsTrackingEnabled ? mezzoPosizioneRealeCoordinate(mezzo) : null;
  if (onMission) {
    return posizioneReale ?? stazionamento ?? null;
  }
  return stazionamento ?? null;
}

/** Marker mappa usa GPS reale (solo se tracking ON, in missione e coordinate presenti). */
export function mezzoMapUsesPosizioneReale(mezzo, onMission, gpsTrackingEnabled = true) {
  return (
    gpsTrackingEnabled && onMission && Boolean(mezzoPosizioneRealeCoordinate(mezzo))
  );
}

function formatTimestamp(ts) {
  if (!ts) return '';
  const d =
    typeof ts.toDate === 'function'
      ? ts.toDate()
      : ts instanceof Date
        ? ts
        : typeof ts === 'object' && ts.seconds != null
          ? new Date(ts.seconds * 1000)
          : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Testo per scheda mezzo: coordinate + ultimo aggiornamento. */
export function formatPosizioneRealeDisplay(mezzo) {
  const coord = mezzoPosizioneRealeCoordinate(mezzo);
  if (!coord) return null;
  const when = formatTimestamp(mezzo?.posizioneReale?.aggiornatoIl);
  const coords = `${coord.lat.toFixed(5)}, ${coord.lng.toFixed(5)}`;
  return when ? `${coords} · ${when}` : coords;
}
