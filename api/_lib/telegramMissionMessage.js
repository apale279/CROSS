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

function toDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value.toDate === 'function') {
    const d = value.toDate();
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const sec = value.seconds ?? value._seconds;
  if (sec != null) {
    const d = new Date(Number(sec) * 1000);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function formatDateTimeCreation(value) {
  const date = toDate(value);
  if (!date) return '—';
  return date.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function displayValue(value) {
  if (value == null || value === '') return '';
  return String(value).trim();
}

function appendLine(lines, label, value) {
  const text = displayValue(value);
  lines.push(`<b>${escapeHtml(label)}:</b> ${escapeHtml(text || '—')}`);
}

function appendHtmlLine(lines, label, htmlValue) {
  lines.push(`<b>${escapeHtml(label)}:</b> ${htmlValue}`);
}

function resolveEventoMissione(payload) {
  const missione = payload.missione ?? payload;
  const evento = payload.evento ?? {};
  return { missione, evento };
}

/**
 * Messaggio invio missione da centrale (campi operativi essenziali).
 * @param {object} payload — da CROSS (evento + missione annidati o flat legacy)
 */
export function formatMissionTelegramHtml(payload) {
  const { missione, evento } = resolveEventoMissione(payload);

  const apertura =
    missione.apertura ?? payload.apertura ?? missione.creazione ?? payload.creazione;
  const idMissione = missione.idMissione ?? payload.idMissione ?? '—';
  const coloreM =
    missione.codiceColoreMissione ??
    missione.codiceColore ??
    payload.colore ??
    '—';

  const indirizzo =
    (evento.indirizzo ?? payload.indirizzo ?? '').trim() || '—';
  const coordinate = evento.coordinate ?? payload.coordinate ?? null;
  const mapsUrl = buildMapsUrl(indirizzo, coordinate);
  const indirizzoHtml = mapsUrl
    ? `<a href="${escapeHtml(mapsUrl)}">${escapeHtml(indirizzo)}</a> 📍`
    : escapeHtml(indirizzo);

  const luogo = displayValue(evento.luogo) || '—';
  const tipoLuogo = displayValue(evento.tipoLuogo) || '—';
  const tipo = displayValue(evento.tipoEvento ?? payload.tipoEvento) || '—';
  const noteEvento = displayValue(evento.noteEvento);

  const lines = ['<b>🚨 Nuova missione</b>', ''];

  appendLine(lines, 'Data e ora creazione', formatDateTimeCreation(apertura));
  appendLine(lines, 'ID missione', idMissione);
  appendLine(lines, 'Codice colore M', coloreM);
  appendHtmlLine(lines, 'Indirizzo', indirizzoHtml);
  appendLine(lines, 'Luogo', luogo);
  appendLine(lines, 'Tipo luogo', tipoLuogo);
  appendLine(lines, 'Tipo', tipo);
  if (noteEvento) {
    appendLine(lines, 'Note evento', noteEvento);
  }

  return lines.join('\n');
}
