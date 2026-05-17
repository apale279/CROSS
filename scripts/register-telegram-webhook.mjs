#!/usr/bin/env node
/**
 * Registra il webhook Telegram su Vercel.
 *
 * Uso:
 *   TELEGRAM_BOT_TOKEN=... WEBHOOK_BASE_URL=https://tuo-dominio.vercel.app \
 *   TELEGRAM_TENANT_ID=Lr4XjZ... TELEGRAM_WEBHOOK_SECRET=opzionale \
 *   node scripts/register-telegram-webhook.mjs
 */
const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
const base = (process.env.WEBHOOK_BASE_URL ?? '').replace(/\/$/, '');
const tenant = process.env.TELEGRAM_TENANT_ID?.trim();
const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();

if (!token || !base) {
  console.error('Servono TELEGRAM_BOT_TOKEN e WEBHOOK_BASE_URL (es. https://cross.vercel.app)');
  process.exit(1);
}

const url = new URL(`${base}/api/telegram-webhook`);
if (tenant) url.searchParams.set('tenant', tenant);

const body = {
  url: url.toString(),
  allowed_updates: ['message', 'edited_message', 'callback_query'],
};
if (secret) body.secret_token = secret;

const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
const data = await res.json();
console.log('setWebhook:', JSON.stringify(data, null, 2));

if (data.ok) {
  const infoRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
  const info = await infoRes.json();
  console.log('getWebhookInfo:', JSON.stringify(info, null, 2));
  if (secret) {
    console.log(
      '\nWebhook registrato CON secret_token. Assicurati che TELEGRAM_WEBHOOK_SECRET su Vercel sia identico.',
    );
  }
}

process.exit(data.ok ? 0 : 1);
