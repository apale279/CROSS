import { escapeHtml, sendMessage } from './telegramApi.js';
import {
  findChatIdsByMezzo,
  isTelegramBotEnabled,
} from './telegramFirestore.js';
import { getMissioneById, getStatiMissione } from './missionAdmin.js';
import {
  isStatoMissioneTerminale,
  nextStatoMissione,
  shouldOfferTelegramStatoAdvanceButton,
} from './missionStati.js';
import { buildStatoAdvanceKeyboard } from './telegramMissionStato.js';
import { appendMissionTelegramMessage } from './telegramMissionMessages.js';
import { sealMissionTelegramMessages } from './telegramMissionClose.js';

function buildChiusuraTelegramLines(missione, { eliminata = false } = {}) {
  const stato = missione.stato ?? '—';
  const lines = [];

  if (eliminata) {
    lines.push('<b>🗑️ Missione eliminata dalla centrale</b>');
  } else if (stato === 'ANNULLATA') {
    lines.push('<b>🚫 Missione annullata dalla centrale</b>');
  } else if (stato === 'FINE MISSIONE') {
    lines.push('<b>✅ Missione terminata dalla centrale</b>');
  } else {
    lines.push('<b>📡 Stato aggiornato dalla centrale</b>');
  }

  lines.push(
    '',
    `<b>Missione:</b> ${escapeHtml(missione.idMissione ?? '—')}`,
    `<b>Evento:</b> ${escapeHtml(missione.eventoCorrelato ?? '—')}`,
    `<b>Stato attuale:</b> ${escapeHtml(stato)}`,
  );

  return lines;
}

function chiusuraTelegramFooter(missione, { eliminata = false, terminal = false } = {}) {
  if (eliminata) {
    return '<i>Missione <b>rimossa</b> da CROSS. Non è più modificabile su Telegram.</i>';
  }
  if (missione.stato === 'ANNULLATA') {
    return '<i>Missione <b>chiusa</b> (annullata). Non è più modificabile su Telegram.</i>';
  }
  if (terminal || missione.stato === 'FINE MISSIONE') {
    return '<i>Missione <b>terminata</b>. Non è più modificabile su Telegram.</i>';
  }
  return null;
}

/**
 * Avvisa l'equipaggio su Telegram dopo un cambio stato dalla centrale CROSS.
 * Legge sempre lo stato aggiornato su Firestore (anche se forzato / saltato).
 */
export async function notifyMissionStatoToTelegram(tenantId, missionDocId, options = {}) {
  const eliminata = options.eliminata === true;
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
  const terminal = eliminata || missione.aperta === false || isStatoMissioneTerminale(stato);
  const next = nextStatoMissione(stato, stati);

  let sealed;
  if (terminal) {
    sealed = await sealMissionTelegramMessages(missione);
  }

  const lines = buildChiusuraTelegramLines(missione, { eliminata });
  const footer = chiusuraTelegramFooter(missione, { eliminata, terminal });

  let replyMarkup;
  if (terminal) {
    if (footer) lines.push('', footer);
  } else if (
    shouldOfferTelegramStatoAdvanceButton({ stato, next, aperta: missione.aperta })
  ) {
    lines.push('', `<i>Prossimo passo equipaggio:</i> ${escapeHtml(next)}`);
    replyMarkup = buildStatoAdvanceKeyboard(missionDocId, next);
  }

  const text = lines.join('\n');
  let sent = 0;
  const errors = [];

  for (const chatId of chatIds) {
    try {
      const apiRes = await sendMessage(chatId, text, replyMarkup ? { reply_markup: replyMarkup } : {});
      const messageId = apiRes?.result?.message_id;
      if (!eliminata && messageId != null) {
        await appendMissionTelegramMessage(tenantId, missionDocId, chatId, messageId);
      }
      sent += 1;
    } catch (e) {
      errors.push({ chatId, message: e.message });
    }
  }

  return {
    sent,
    total: chatIds.length,
    sealed,
    errors: errors.length ? errors : undefined,
  };
}
