import { getWebhookSecret } from './_lib/env.js';
import { requireTenant, resolveTenantFromRequest } from './_lib/resolveTenant.js';
import {
  answerCallbackQuery,
} from './_lib/telegramApi.js';
import {
  handleCambiaPassword,
  handleMezzoCallback,
  handlePasswordText,
  handleStart,
} from './_lib/telegramBotFlow.js';
import {
  handleStatoAdvanceCallback,
  handleStatoCommand,
  handleStatoSelectCallback,
} from './_lib/telegramStatoFlow.js';
import { isTelegramBotEnabled } from './_lib/telegramFirestore.js';
import { handleSosCommand, isSosTelegramText } from './_lib/telegramSosFlow.js';
import {
  handleGpsCommand,
  handleGpsConsentCallback,
  handleGpsSendNowCallback,
  handleLocationMessage,
} from './_lib/telegramGpsFlow.js';
import {
  TG_MENU_GPS,
  TG_MENU_SOS,
  TG_MENU_START,
  TG_MENU_STATO,
} from './_lib/telegramKeyboard.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const tenant = resolveTenantFromRequest(req) || null;
    const secretConfigured = Boolean(getWebhookSecret());
    return res.status(200).json({
      ok: true,
      service: 'telegram-webhook',
      tenant,
      webhookSecretRequired: secretConfigured,
      hint: secretConfigured
        ? 'Telegram deve inviare header x-telegram-bot-api-secret-token (register-telegram-webhook.mjs).'
        : undefined,
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = getWebhookSecret();
  const isProd =
    process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
  if (!secret) {
    if (isProd) {
      console.error('[telegram-webhook] TELEGRAM_WEBHOOK_SECRET mancante in produzione');
      return res.status(503).json({ error: 'Webhook non configurato' });
    }
  } else {
    const header = req.headers['x-telegram-bot-api-secret-token'];
    if (header !== secret) {
      console.error(
        '[telegram-webhook] 401: secret webhook mancante o non valido. Riesegui scripts/register-telegram-webhook.mjs con lo stesso TELEGRAM_WEBHOOK_SECRET di Vercel.',
      );
      return res.status(401).json({
        error: 'Unauthorized',
        hint: 'Webhook secret non valido. Riregistra il webhook con scripts/register-telegram-webhook.mjs.',
      });
    }
  }

  try {
    const tenantId = requireTenant(req);
    const update = req.body ?? {};
    const enabled = await isTelegramBotEnabled(tenantId);

    if (update.callback_query) {
      const cq = update.callback_query;
      const chatId = cq.message?.chat?.id ?? cq.from?.id;
      if (chatId && cq.data === TG_MENU_STATO) {
        await answerCallbackQuery(cq.id, 'Stato missione');
        await handleStatoCommand(chatId, tenantId);
        return res.status(200).json({ ok: true });
      }
      if (chatId && cq.data === TG_MENU_GPS) {
        await answerCallbackQuery(cq.id, 'GPS mezzo');
        await handleGpsCommand(chatId, tenantId);
        return res.status(200).json({ ok: true });
      }
      if (chatId && cq.data === TG_MENU_START) {
        await answerCallbackQuery(cq.id, 'Cambia mezzo');
        await handleStart(chatId, tenantId, enabled);
        return res.status(200).json({ ok: true });
      }
      if (chatId && cq.data === TG_MENU_SOS) {
        await answerCallbackQuery(cq.id, 'SOS');
        await handleSosCommand(chatId, tenantId, cq.from);
        return res.status(200).json({ ok: true });
      }
      if (await handleGpsConsentCallback(cq, tenantId)) {
        return res.status(200).json({ ok: true });
      }
      if (await handleGpsSendNowCallback(cq, tenantId)) {
        return res.status(200).json({ ok: true });
      }
      if (await handleStatoAdvanceCallback(cq, tenantId)) {
        return res.status(200).json({ ok: true });
      }
      if (await handleStatoSelectCallback(cq, tenantId)) {
        return res.status(200).json({ ok: true });
      }
      await handleMezzoCallback(cq, tenantId);
      return res.status(200).json({ ok: true });
    }

    const msg = update.message ?? update.edited_message;
    if (!msg) {
      return res.status(200).json({ ok: true, ignored: true });
    }

    const chatId = msg.chat?.id ?? msg.from?.id;
    if (!chatId) {
      return res.status(200).json({ ok: true, ignored: true });
    }
    const text = msg.text?.trim() ?? '';

    const isStart = /^\/start(\s|$|@)/i.test(text);
    const isCambiaPassword = /^\/cambiapassword(\s|$|@)/i.test(text) || /^CAMBIA\s+PASSWORD$/i.test(text);
    const isStato = /^\/stato(\s|$|@)/i.test(text);
    const isGps = /^\/gps(\s|$|@)/i.test(text);
    const isSos = isSosTelegramText(text);

    if (msg.location && enabled) {
      if (await handleLocationMessage(chatId, tenantId, msg)) {
        return res.status(200).json({ ok: true });
      }
    }

    if (isStart) {
      await handleStart(chatId, tenantId, enabled);
      return res.status(200).json({ ok: true });
    }

    if (isCambiaPassword) {
      if (!enabled) {
        return res.status(200).json({ ok: true });
      }
      await handleCambiaPassword(chatId, tenantId);
      return res.status(200).json({ ok: true });
    }

    if (isStato) {
      if (!enabled) {
        return res.status(200).json({ ok: true });
      }
      await handleStatoCommand(chatId, tenantId);
      return res.status(200).json({ ok: true });
    }

    if (isSos) {
      if (!enabled) {
        return res.status(200).json({ ok: true });
      }
      await handleSosCommand(chatId, tenantId, msg.from);
      return res.status(200).json({ ok: true });
    }

    if (isGps) {
      if (!enabled) {
        return res.status(200).json({ ok: true });
      }
      await handleGpsCommand(chatId, tenantId);
      return res.status(200).json({ ok: true });
    }

    if (text && !text.startsWith('/')) {
      await handlePasswordText(chatId, tenantId, text, msg.from);
      return res.status(200).json({ ok: true });
    }

    return res.status(200).json({ ok: true, ignored: true });
  } catch (err) {
    console.error('[telegram-webhook]', err);
    return res.status(200).json({ ok: false, error: err.message ?? 'Internal error' });
  }
}
