import { escapeHtml } from './telegramApi.js';
import { isStatoMissioneTerminale, nextStatoMissione } from './missionStati.js';

export const STATO_AVANCE_PREFIX = 'statoav:';
export const STATO_SEL_PREFIX = 'statosel:';

export function buildStatoAdvanceKeyboard(missionDocId, nextLabel) {
  const label = nextLabel
    ? `▶️ ${nextLabel}`.slice(0, 64)
    : '▶️ Stato successivo';
  return {
    inline_keyboard: [
      [{ text: label, callback_data: `${STATO_AVANCE_PREFIX}${missionDocId}`.slice(0, 64) }],
    ],
  };
}

export function buildMissioniSelectKeyboard(missioni) {
  const rows = missioni.map((m) => [
    {
      text: `${m.idMissione ?? '—'} · ${m.stato ?? '—'}`.slice(0, 64),
      callback_data: `${STATO_SEL_PREFIX}${m._docId}`.slice(0, 64),
    },
  ]);
  return { inline_keyboard: rows };
}

export function formatMissioneStatoPanel(missione, stati, { nextHint = true } = {}) {
  const stato = missione.stato ?? '—';
  const lines = [
    `<b>📋 ${escapeHtml(missione.idMissione ?? '—')}</b>`,
    `<b>Evento:</b> ${escapeHtml(missione.eventoCorrelato ?? '—')}`,
    `<b>Stato attuale:</b> ${escapeHtml(stato)}`,
  ];

  if (nextHint && !isStatoMissioneTerminale(stato) && missione.aperta !== false) {
    const next = nextStatoMissione(stato, stati);
    if (next !== stato) {
      lines.push(`<i>Prossimo:</i> ${escapeHtml(next)}`);
    }
  }

  return lines.join('\n');
}
