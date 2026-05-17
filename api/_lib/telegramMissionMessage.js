import { escapeHtml } from './telegramApi.js';

function parseCoordinate(coordinate) {
  if (!coordinate || typeof coordinate !== 'object') return null;
  const lat = Number(coordinate.lat ?? coordinate.latitude);
  const lng = Number(coordinate.lng ?? coordinate.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/** URL Google Maps per aprire navigazione / mappa. */
export function buildMapsUrl(indirizzo, coordinate) {
  const coord = parseCoordinate(coordinate);
  if (coord) {
    return `https://www.google.com/maps/search/?api=1&query=${coord.lat},${coord.lng}`;
  }
  const addr = (indirizzo ?? '').trim();
  if (addr && addr !== '—') {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`;
  }
  return null;
}

/**
 * @param {object} missione — payload da PMApp (idMissione, mezzo, stato, …)
 * @param {object} [evento] — indirizzo, tipo, dettaglio, colore, coordinate
 */
export function formatMissionTelegramHtml(missione, evento = {}) {
  const indirizzo = missione.indirizzo ?? evento.indirizzo ?? '—';
  const tipo = missione.tipoEvento ?? evento.tipoEvento ?? '';
  const dettaglio = missione.dettaglioEvento ?? evento.dettaglioEvento ?? '';
  const motivo = [tipo, dettaglio].filter(Boolean).join(' — ') || '—';
  const colore = missione.colore ?? evento.colore ?? missione.codiceColore ?? '—';
  const coordinate = missione.coordinate ?? evento.coordinate ?? null;
  const mapsUrl = buildMapsUrl(indirizzo, coordinate);

  const indirizzoHtml = mapsUrl
    ? `<a href="${escapeHtml(mapsUrl)}">${escapeHtml(indirizzo)}</a> 📍`
    : escapeHtml(indirizzo);

  const lines = [
    '<b>🚨 Nuova missione</b>',
    '',
    `<b>Codice:</b> ${escapeHtml(missione.idMissione ?? '—')}`,
    `<b>Evento:</b> ${escapeHtml(missione.eventoCorrelato ?? '—')}`,
    `<b>Mezzo:</b> ${escapeHtml(missione.mezzo ?? '—')}`,
    `<b>Stato:</b> ${escapeHtml(missione.stato ?? '—')}`,
    `<b>Indirizzo:</b> ${indirizzoHtml}`,
    `<b>Motivo:</b> ${escapeHtml(motivo)}`,
    `<b>Colore:</b> ${escapeHtml(colore)}`,
  ];

  const note = missione.noteMissione?.trim();
  if (note) {
    lines.push(`<b>Note:</b> ${escapeHtml(note)}`);
  }

  return lines.join('\n');
}
