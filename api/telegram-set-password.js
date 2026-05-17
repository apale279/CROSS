import { getAdminAuth } from './_lib/firebaseAdmin.js';
import { getTelegramTenantId } from './_lib/env.js';
import {
  invalidateAllTelegramAuth,
  setTelegramBotPassword,
  telegramUsersCollection,
} from './_lib/telegramFirestore.js';
import { sendMessage } from './_lib/telegramApi.js';

async function verifyFirebaseUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw Object.assign(new Error('Token di autenticazione mancante'), { status: 401 });
  }
  return getAdminAuth().verifyIdToken(authHeader.slice(7));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await verifyFirebaseUser(req);
    const tenantId = getTelegramTenantId();
    const password = String(req.body?.password ?? '').trim();
    const notify = req.body?.notifyUsers !== false;

    if (!password) {
      await setTelegramBotPassword(tenantId, null);
      return res.status(200).json({ ok: true, cleared: true });
    }

    if (password.length < 4) {
      return res.status(400).json({ error: 'Password troppo corta (minimo 4 caratteri)' });
    }

    const { epoch } = await setTelegramBotPassword(tenantId, password);
    const invalidated = await invalidateAllTelegramAuth(tenantId);

    if (notify && invalidated > 0) {
      const snap = await telegramUsersCollection(tenantId).get();
      const text =
        '🔐 <b>Password aggiornata.</b> Sei stato disconnesso.\n\n1️⃣ /cambiapassword → nuova password\n2️⃣ /start → scegli di nuovo il mezzo';
      await Promise.allSettled(
        snap.docs.map((d) => {
          const chatId = d.data()?.chatId;
          if (chatId) return sendMessage(chatId, text);
          return Promise.resolve();
        }),
      );
    }

    return res.status(200).json({
      ok: true,
      epoch,
      invalidated,
    });
  } catch (err) {
    const status = err.status ?? 500;
    if (status >= 500) console.error('[telegram-set-password]', err);
    return res.status(status).json({ error: err.message ?? 'Internal error' });
  }
}
