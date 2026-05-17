import {
  answerCallbackQuery,
  sendMessage,
} from './telegramApi.js';
import {
  getTelegramAuthSettings,
  getTelegramUser,
  listMezziSigle,
  setTelegramUserAwaitingPassword,
  setTelegramUserAuthenticated,
  upsertTelegramUser,
} from './telegramFirestore.js';
import { verifyBotPassword } from './telegramPassword.js';

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

export async function promptForPassword(chatId, tenantId, reason = '') {
  await setTelegramUserAwaitingPassword(tenantId, chatId, true);
  const intro = reason
    ? `${reason}\n\n`
    : '';
  await sendMessage(
    chatId,
    `${intro}<b>Inserisci la password del bot</b> (solo testo, un messaggio).`,
  );
}

export async function ensureAuthenticatedOrPrompt(chatId, tenantId, settings, user) {
  if (!settings.required) return true;
  const authed = user && user.passwordEpoch === settings.epoch;
  if (authed) return true;
  await promptForPassword(
    chatId,
    tenantId,
    'Accesso richiesto. La centrale ha impostato una password per il bot.',
  );
  return false;
}

export async function handlePasswordText(chatId, tenantId, text, from) {
  const settings = await getTelegramAuthSettings(tenantId);
  const existing = await getTelegramUser(tenantId, chatId);

  if (!settings.required) {
    if (!existing?.mezzo) await sendMezzoPicker(chatId, tenantId);
    else await sendMessage(chatId, `Sei registrato su <b>${existing.mezzo}</b>. Usa /start per cambiare mezzo.`);
    return;
  }

  const authed = existing && existing.passwordEpoch === settings.epoch;
  if (authed && existing.mezzo && !existing.awaitingPassword) {
    await sendMessage(chatId, `Sei registrato su <b>${existing.mezzo}</b>. Usa /start per cambiare mezzo.`);
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

  const user = await getTelegramUser(tenantId, chatId);
  if (user?.mezzo) {
    await sendMessage(
      chatId,
      `✅ Accesso consentito. Riceverai le missioni per <b>${user.mezzo}</b>.`,
    );
    return;
  }

  await sendMessage(chatId, '✅ Password corretta.');
  await sendMezzoPicker(chatId, tenantId);
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

  await sendMezzoPicker(chatId, tenantId);
}

export async function handleCambiaPassword(chatId, tenantId) {
  const settings = await getTelegramAuthSettings(tenantId);
  if (!settings.required) {
    await sendMessage(chatId, 'Il bot non richiede password. Nessuna azione necessaria.');
    return;
  }

  await setTelegramUserAwaitingPassword(tenantId, chatId, true);
  await setTelegramUserAuthenticated(tenantId, chatId, 0);
  await sendMessage(
    chatId,
    '<b>Password aggiornata dalla centrale.</b>\n\nInserisci la <b>nuova password</b> del bot (messaggio di testo).',
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
  await sendMessage(chatId, `Perfetto! Riceverai le missioni per <b>${mezzo}</b> qui.`);
}
