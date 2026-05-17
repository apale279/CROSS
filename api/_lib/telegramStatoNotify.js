import { escapeHtml, sendMessage } from './telegramApi.js';
import {
  findChatIdsByMezzo,
  isTelegramBotEnabled,
} from './telegramFirestore.js';
import { getMissioneById, getStatiMissione } from './missionAdmin.js';
import { isStatoMissioneTerminale, nextStatoMissione } from './missionStati.js';
import { buildStatoAdvanceKeyboard } from './telegramMissionStato.js';

/**
 * Avvisa l'equipaggio su Telegram dopo un cambio stato dalla centrale CROSS.
 * Legge sempre lo stato aggiornato su Firestore (anche se forzato / saltato).
 */
export async function notifyMissionStatoToTelegram(tenantId, missionDocId) {
  const enabled = await isTelegramBotEnabled(tenantId);
  if (!enabled) return { sent: 0, skipped: 'bot_disabled' };

  const missione = await getMissioneById(tenantId, missionDocId);
  if (!missione?.mezzo) return { sent: 0, skipped: 'no_mezzo' };

  const chatIds = await findChatIdsByMezzo(tenantId, missione.mezzo, {
    authenticatedOnly: true,
  });
  if (!chatIds.length) return { sent: 0, skipped: 'no_recipients' };

  const stati = await getStatiMissione(tenantId);
  const stato = missione.stato ?? 'ALLERTARE';
  const terminal = missione.aperta === false || isStatoMissioneTerminale(stato);
  const next = nextStatoMissione(stato, stati);

  const lines = [
    stato === 'ANNULLATA'
      ? '<b>🚫 Missione annullata dalla centrale</b>'
      : '<b>📡 Stato aggiornato dalla centrale</b>',
    '',
    `<b>Missione:</b> ${escapeHtml(missione.idMissione ?? '—')}`,
    `<b>Evento:</b> ${escapeHtml(missione.eventoCorrelato ?? '—')}`,
    `<b>Stato attuale:</b> ${escapeHtml(stato)}`,
  ];

  let replyMarkup;
  if (stato === 'ANNULLATA' || terminal) {
    lines.push(
      '',
      stato === 'ANNULLATA'
        ? '<i>Missione <b>chiusa</b> (annullata). I pulsanti stato su Telegram non sono più attivi.</i>'
        : '<i>Missione chiusa — nessun passo successivo.</i>',
    );
  } else if (next !== stato) {
    lines.push('', `<i>Prossimo passo equipaggio:</i> ${escapeHtml(next)}`);
    replyMarkup = buildStatoAdvanceKeyboard(missionDocId, next);
  }

  const text = lines.join('\n');
  let sent = 0;
  const errors = [];

  for (const chatId of chatIds) {
    try {
      await sendMessage(chatId, text, replyMarkup ? { reply_markup: replyMarkup } : {});
      sent += 1;
    } catch (e) {
      errors.push({ chatId, message: e.message });
    }
  }

  return { sent, total: chatIds.length, errors: errors.length ? errors : undefined };
}
