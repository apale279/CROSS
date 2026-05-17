import { getAdminAuth } from './_lib/firebaseAdmin.js';
import { requireTenant } from './_lib/resolveTenant.js';
import { escapeHtml, sendMessage } from './_lib/telegramApi.js';
import { isTelegramBotEnabled } from './_lib/telegramFirestore.js';
import { listTelegramLoggedInChatIds } from './_lib/telegramLoggedUsers.js';

async function verifyFirebaseUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw Object.assign(new Error('Token di autenticazione mancante'), { status: 401 });
  }
  return getAdminAuth().verifyIdToken(authHeader.slice(7));
}

function formatNotaBroadcastHtml(titolo, testo) {
  const t = escapeHtml(titolo);
  const body = escapeHtml(testo);
  return `📢 <b>NOTA DIARIO — CENTRALE</b>\n\n<b>${t}</b>${body ? `\n\n${body}` : ''}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await verifyFirebaseUser(req);

    const body = req.body ?? {};
    const tenantId = requireTenant(req, body);
    const titolo = String(body.titolo ?? '').trim();
    const testo = String(body.testo ?? '').trim();

    if (!titolo) {
      return res.status(400).json({ error: 'Titolo nota obbligatorio' });
    }

    const enabled = await isTelegramBotEnabled(tenantId);
    if (!enabled) {
      return res.status(403).json({ error: 'Bot Telegram disattivato' });
    }

    const chatIds = await listTelegramLoggedInChatIds(tenantId);
    if (!chatIds.length) {
      return res.status(200).json({
        ok: true,
        sent: 0,
        total: 0,
        error: 'Nessun equipaggio loggato sul bot',
      });
    }

    const html = formatNotaBroadcastHtml(titolo, testo);
    let sent = 0;
    const errors = [];

    for (const chatId of chatIds) {
      try {
        await sendMessage(chatId, html);
        sent += 1;
      } catch (err) {
        errors.push({ chatId, message: err.message ?? 'Errore invio' });
      }
    }

    return res.status(200).json({
      ok: sent > 0,
      sent,
      total: chatIds.length,
      errors: errors.length ? errors : undefined,
    });
  } catch (err) {
    const status = err.status ?? 500;
    if (status >= 500) console.error('[telegram-broadcast-nota]', err);
    return res.status(status).json({ error: err.message ?? 'Internal error' });
  }
}
