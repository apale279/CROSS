import { getWebhookSecret } from './_lib/env.js';
import { requireTenant, resolveTenantFromRequest } from './_lib/resolveTenant.js';
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

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const tenant = resolveTenantFromRequest(req) || null;
    return res.status(200).json({ ok: true, service: 'telegram-webhook', tenant });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = getWebhookSecret();
  if (secret) {
    const header = req.headers['x-telegram-bot-api-secret-token'];
    if (header !== secret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    const tenantId = requireTenant(req);
    const update = req.body ?? {};
    const enabled = await isTelegramBotEnabled(tenantId);

    if (update.callback_query) {
      const cq = update.callback_query;
      if (await handleStatoAdvanceCallback(cq, tenantId)) {
        return res.status(200).json({ ok: true });
      }
      if (await handleStatoSelectCallback(cq, tenantId)) {
        return res.status(200).json({ ok: true });
      }
      await handleMezzoCallback(cq, tenantId);
      return res.status(200).json({ ok: true });
    }

    const msg = update.message;
    if (!msg) {
      return res.status(200).json({ ok: true, ignored: true });
    }

    const chatId = msg.chat.id;
    const text = msg.text?.trim() ?? '';

    const isStart = /^\/start(\s|$|@)/i.test(text);
    const isCambiaPassword = /^\/cambiapassword(\s|$|@)/i.test(text) || /^CAMBIA\s+PASSWORD$/i.test(text);
    const isStato = /^\/stato(\s|$|@)/i.test(text);
    const isSos = isSosTelegramText(text);

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
