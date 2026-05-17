import {
  answerCallbackQuery,
  sendMessage,
} from './telegramApi.js';
import {
  getTelegramAuthSettings,
  getTelegramUser,
  listMezziSigle,
  clearTelegramUserMezzo,
  resetTelegramUserSession,
  setTelegramUserAuthenticated,
  upsertTelegramUser,
} from './telegramFirestore.js';
import { ensureAuthenticatedOrPrompt, promptForPassword } from './telegramAuth.js';
import { verifyBotPassword } from './telegramPassword.js';
import { buildEquipaggioReplyKeyboard } from './telegramKeyboard.js';
import { mezzoRichiedeGpsTelegram } from './mezzoTacticalBoard.js';
import { promptGpsConsentIfNeeded } from './telegramGpsFlow.js';

export { ensureAuthenticatedOrPrompt, promptForPassword };

export const MEZZO_PREFIX = 'mezzo:';

export function buildMezzoKeyboard(sigle) {
  const rows = [];
  for (let i = 0; i < sigle.length; i += 2) {
    const row = sigle.slice(i, i + 2).map((sigla) => ({
      text: sigla,
      callback_data: `${MEZZO_PREFIX}${sigla}`.slice(0, 64),
    }));
    rows.push(row);
  }
  return { inline_keyboard: rows };
}

export async function sendMezzoPicker(chatId, tenantId) {
  const sigle = await listMezziSigle(tenantId);
  if (!sigle.length) {
    await sendMessage(chatId, 'Nessun mezzo configurato in CROSS. Contatta la centrale operativa.');
    return;
  }
  await sendMessage(chatId, '<b>A quale mezzo sei assegnato?</b>', {
    reply_markup: buildMezzoKeyboard(sigle),
  });
}

export async function handlePasswordText(chatId, tenantId, text, from) {
  const settings = await getTelegramAuthSettings(tenantId);
  const existing = await getTelegramUser(tenantId, chatId);

  if (!settings.required) {
    if (!existing?.mezzo) {
      await sendMezzoPicker(chatId, tenantId);
    } else {
      await sendMessage(
        chatId,
        `Sei registrato su <b>${existing.mezzo}</b>. Usa /start per cambiare mezzo.`,
      );
      await promptGpsConsentIfNeeded(chatId, tenantId);
    }
    return;
  }

  const authed = existing && existing.passwordEpoch === settings.epoch;
  if (authed && !existing.awaitingPassword) {
    if (!existing.mezzo?.trim()) {
      await sendMessage(chatId, 'Invia <b>/start</b> per scegliere il mezzo.');
      return;
    }
    await sendMessage(
      chatId,
      `Sei registrato su <b>${existing.mezzo}</b>. Usa /start per cambiare mezzo.`,
    );
    await promptGpsConsentIfNeeded(chatId, tenantId);
    return;
  }

  const password = text.trim();
  if (!password) {
    await sendMessage(chatId, 'Password vuota. Riprova.');
    return;
  }

  if (!verifyBotPassword(password, settings.salt, settings.hash)) {
    await sendMessage(chatId, '❌ Password errata. Riprova o contatta la centrale.');
    return;
  }

  await setTelegramUserAuthenticated(tenantId, chatId, settings.epoch, {
    firstName: from?.first_name,
    username: from?.username,
  });

  await sendMessage(
    chatId,
    '✅ Password corretta.\n\nInvia <b>/start</b> per scegliere di nuovo il mezzo.',
  );
}

export async function handleStart(chatId, tenantId, enabled) {
  if (!enabled) {
    await sendMessage(
      chatId,
      'Il bot missioni non è attivo in questo momento. Contatta la centrale operativa.',
    );
    return;
  }

  const settings = await getTelegramAuthSettings(tenantId);
  const user = await getTelegramUser(tenantId, chatId);

  if (settings.required) {
    const authed = user && user.passwordEpoch === settings.epoch;
    if (!authed) {
      await promptForPassword(chatId, tenantId);
      return;
    }
  }

  await clearTelegramUserMezzo(tenantId, chatId);
  await sendMezzoPicker(chatId, tenantId);
}

export async function handleCambiaPassword(chatId, tenantId) {
  const settings = await getTelegramAuthSettings(tenantId);
  if (!settings.required) {
    await sendMessage(chatId, 'Il bot non richiede password. Nessuna azione necessaria.');
    return;
  }

  await resetTelegramUserSession(tenantId, chatId);
  await sendMessage(
    chatId,
    '<b>Sessione terminata.</b> Password aggiornata dalla centrale.\n\n1️⃣ Inserisci la <b>nuova password</b>\n2️⃣ Poi invia <b>/start</b> per scegliere il mezzo',
  );
}

export async function handleMezzoCallback(callbackQuery, tenantId) {
  const data = callbackQuery.data ?? '';
  if (!data.startsWith(MEZZO_PREFIX)) {
    await answerCallbackQuery(callbackQuery.id, 'Selezione non valida');
    return;
  }

  const mezzo = data.slice(MEZZO_PREFIX.length);
  const chatId = callbackQuery.message?.chat?.id ?? callbackQuery.from?.id;
  if (!chatId || !mezzo) {
    await answerCallbackQuery(callbackQuery.id, 'Errore registrazione');
    return;
  }

  const settings = await getTelegramAuthSettings(tenantId);
  const user = await getTelegramUser(tenantId, chatId);
  if (!(await ensureAuthenticatedOrPrompt(chatId, tenantId, settings, user))) {
    await answerCallbackQuery(callbackQuery.id, 'Inserisci prima la password');
    return;
  }

  await upsertTelegramUser(tenantId, chatId, mezzo, {
    firstName: callbackQuery.from?.first_name,
    username: callbackQuery.from?.username,
    passwordEpoch: settings.epoch,
  });

  await answerCallbackQuery(callbackQuery.id, `Registrato su ${mezzo}`);
  const richiedeGps = await mezzoRichiedeGpsTelegram(tenantId, mezzo);
  const righe = [
    `Perfetto! Riceverai le missioni per <b>${mezzo}</b> qui.\n`,
    `• <b>/stato</b> — aggiorna stato missione`,
    `• <b>🚨 SOS / EMERGENZA</b> — allarme immediato alla centrale`,
  ];
  if (richiedeGps) {
    righe.push(`• <b>/gps</b> — gestione posizione GPS`);
  }
  await sendMessage(chatId, righe.join('\n'), { reply_markup: buildEquipaggioReplyKeyboard() });

  await promptGpsConsentIfNeeded(chatId, tenantId);
}
