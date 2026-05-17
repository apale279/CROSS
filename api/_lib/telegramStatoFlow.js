import { answerCallbackQuery, escapeHtml, sendMessage } from './telegramApi.js';
import {
  advanceMissioneStato,
  getMissioneById,
  getStatiMissione,
  listMissioniAperteByMezzo,
} from './missionAdmin.js';
import {
  getTelegramAuthSettings,
  getTelegramUser,
} from './telegramFirestore.js';
import { ensureAuthenticatedOrPrompt } from './telegramAuth.js';
import {
  STATO_AVANCE_PREFIX,
  STATO_SEL_PREFIX,
  buildMissioniSelectKeyboard,
  buildStatoAdvanceKeyboard,
  formatMissioneStatoPanel,
} from './telegramMissionStato.js';
import { isStatoMissioneTerminale, nextStatoMissione } from './missionStati.js';
import { promptGpsAfterStatoAdvance } from './telegramGpsFlow.js';

async function requireRegisteredUser(chatId, tenantId) {
  const settings = await getTelegramAuthSettings(tenantId);
  const user = await getTelegramUser(tenantId, chatId);
  if (!(await ensureAuthenticatedOrPrompt(chatId, tenantId, settings, user))) {
    return null;
  }
  const mezzo = user?.mezzo?.trim();
  if (!mezzo) {
    await sendMessage(chatId, 'Prima invia <b>/start</b> e scegli il mezzo.');
    return null;
  }
  return { user, mezzo, settings };
}

export async function handleStatoCommand(chatId, tenantId) {
  const ctx = await requireRegisteredUser(chatId, tenantId);
  if (!ctx) return;

  const { mezzo } = ctx;
  const missioni = await listMissioniAperteByMezzo(tenantId, mezzo);
  if (!missioni.length) {
    await sendMessage(chatId, `Nessuna missione aperta per <b>${escapeHtml(mezzo)}</b>.`);
    return;
  }

  const stati = await getStatiMissione(tenantId);

  if (missioni.length === 1) {
    const m = missioni[0];
    const next = nextStatoMissione(m.stato ?? 'ALLERTARE', stati);
    await sendMessage(chatId, formatMissioneStatoPanel(m, stati), {
      reply_markup:
        next !== m.stato && !isStatoMissioneTerminale(m.stato)
          ? buildStatoAdvanceKeyboard(m._docId, next)
          : undefined,
    });
    return;
  }

  await sendMessage(chatId, `<b>Missioni aperte — ${escapeHtml(mezzo)}</b>\nScegli la missione:`, {
    reply_markup: buildMissioniSelectKeyboard(missioni),
  });
}

export async function handleStatoSelectCallback(callbackQuery, tenantId) {
  const data = callbackQuery.data ?? '';
  if (!data.startsWith(STATO_SEL_PREFIX)) return false;

  const missionDocId = data.slice(STATO_SEL_PREFIX.length);
  const chatId = callbackQuery.message?.chat?.id ?? callbackQuery.from?.id;
  if (!chatId || !missionDocId) {
    await answerCallbackQuery(callbackQuery.id, 'Selezione non valida');
    return true;
  }

  const ctx = await requireRegisteredUser(chatId, tenantId);
  if (!ctx) {
    await answerCallbackQuery(callbackQuery.id, 'Registrati con /start');
    return true;
  }

  const missione = await getMissioneById(tenantId, missionDocId);
  if (!missione || missione.mezzo !== ctx.mezzo) {
    await answerCallbackQuery(callbackQuery.id, 'Missione non valida');
    return true;
  }

  const stati = await getStatiMissione(tenantId);
  const next = nextStatoMissione(missione.stato ?? 'ALLERTARE', stati);

  await answerCallbackQuery(callbackQuery.id);
  await sendMessage(chatId, formatMissioneStatoPanel(missione, stati), {
    reply_markup:
      next !== missione.stato && missione.aperta !== false && !isStatoMissioneTerminale(missione.stato)
        ? buildStatoAdvanceKeyboard(missionDocId, next)
        : undefined,
  });
  return true;
}

export async function handleStatoAdvanceCallback(callbackQuery, tenantId) {
  const data = callbackQuery.data ?? '';
  if (!data.startsWith(STATO_AVANCE_PREFIX)) return false;

  const missionDocId = data.slice(STATO_AVANCE_PREFIX.length);
  const chatId = callbackQuery.message?.chat?.id ?? callbackQuery.from?.id;
  if (!chatId || !missionDocId) {
    await answerCallbackQuery(callbackQuery.id, 'Azione non valida');
    return true;
  }

  const ctx = await requireRegisteredUser(chatId, tenantId);
  if (!ctx) {
    await answerCallbackQuery(callbackQuery.id, 'Registrati con /start');
    return true;
  }

  const missioneCheck = await getMissioneById(tenantId, missionDocId);
  if (
    missioneCheck?.aperta === false ||
    isStatoMissioneTerminale(missioneCheck?.stato)
  ) {
    await answerCallbackQuery(callbackQuery.id, 'Missione chiusa', true);
    await sendMessage(
      chatId,
      `🚫 <b>${escapeHtml(missioneCheck?.idMissione ?? '—')}</b> è chiusa (${escapeHtml(missioneCheck?.stato ?? '—')}). Non è possibile aggiornare lo stato da Telegram.`,
    );
    return true;
  }

  const result = await advanceMissioneStato(tenantId, missionDocId, ctx.mezzo);
  if (!result.ok) {
    await answerCallbackQuery(callbackQuery.id, result.error ?? 'Errore', true);
    return true;
  }

  const stati = await getStatiMissione(tenantId);
  const missione = await getMissioneById(tenantId, missionDocId);
  const next = nextStatoMissione(result.nuovo, stati);

  await answerCallbackQuery(
    callbackQuery.id,
    `${result.precedente} → ${result.nuovo}`,
  );

  const msg = [
    `✅ <b>${escapeHtml(missione?.idMissione ?? '—')}</b>`,
    `${escapeHtml(result.precedente)} → <b>${escapeHtml(result.nuovo)}</b>`,
    '',
    formatMissioneStatoPanel(missione ?? { stato: result.nuovo }, stati, { nextHint: false }),
  ].join('\n');

  await sendMessage(chatId, msg, {
    reply_markup:
      !result.terminal && next !== result.nuovo
        ? buildStatoAdvanceKeyboard(missionDocId, next)
        : undefined,
  });

  await promptGpsAfterStatoAdvance(chatId, tenantId);
  return true;
}
