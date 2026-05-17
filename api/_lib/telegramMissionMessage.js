import { escapeHtml } from './telegramApi.js';

/**
 * @param {object} missione — payload da PMApp (idMissione, mezzo, stato, …)
 * @param {object} [evento] — indirizzo, tipo, dettaglio, colore
 */
export function formatMissionTelegramHtml(missione, evento = {}) {
  const indirizzo = missione.indirizzo ?? evento.indirizzo ?? '—';
  const tipo = missione.tipoEvento ?? evento.tipoEvento ?? '';
  const dettaglio = missione.dettaglioEvento ?? evento.dettaglioEvento ?? '';
  const motivo = [tipo, dettaglio].filter(Boolean).join(' — ') || '—';
  const colore = missione.colore ?? evento.colore ?? missione.codiceColore ?? '—';

  const lines = [
    '<b>🚨 Nuova missione</b>',
    '',
    `<b>Codice:</b> ${escapeHtml(missione.idMissione ?? '—')}`,
    `<b>Evento:</b> ${escapeHtml(missione.eventoCorrelato ?? '—')}`,
    `<b>Mezzo:</b> ${escapeHtml(missione.mezzo ?? '—')}`,
    `<b>Stato:</b> ${escapeHtml(missione.stato ?? '—')}`,
    `<b>Indirizzo:</b> ${escapeHtml(indirizzo)}`,
    `<b>Motivo:</b> ${escapeHtml(motivo)}`,
    `<b>Colore:</b> ${escapeHtml(colore)}`,
  ];

  const note = missione.noteMissione?.trim();
  if (note) {
    lines.push(`<b>Note:</b> ${escapeHtml(note)}`);
  }

  return lines.join('\n');
}
