import { parseCoordinate } from './googleMaps';

/** Coordinate GPS reali del mezzo (Telegram), se presenti. */
export function mezzoPosizioneRealeCoordinate(mezzo) {
  return parseCoordinate(mezzo?.posizioneReale?.coordinate);
}

/** Per mappa operativa: posizione reale, altrimenti stazionamento. */
export function mezzoMapCoordinate(mezzo) {
  return mezzoPosizioneRealeCoordinate(mezzo) ?? parseCoordinate(mezzo?.stazionamento?.coordinate);
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
