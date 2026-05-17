#!/usr/bin/env node
/**
 * Diagnostica webhook Telegram (getWebhookInfo + probe endpoint CROSS).
 *
 * Uso:
 *   TELEGRAM_BOT_TOKEN=... WEBHOOK_BASE_URL=https://cross-pied.vercel.app \
 *   TELEGRAM_WEBHOOK_SECRET=... node scripts/check-telegram-webhook.mjs
 */
const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
const base = (process.env.WEBHOOK_BASE_URL ?? '').replace(/\/$/, '');
const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();

if (!token) {
  console.error('Manca TELEGRAM_BOT_TOKEN');
  process.exit(1);
}

const infoRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
const info = await infoRes.json();
console.log('--- getWebhookInfo ---');
console.log(JSON.stringify(info, null, 2));

if (base) {
  const healthUrl = `${base}/api/telegram-webhook`;
  const health = await fetch(healthUrl).then((r) => r.json().catch(() => ({})));
  console.log('\n--- GET', healthUrl, '---');
  console.log(JSON.stringify(health, null, 2));

  const probeUrl = secret
    ? healthUrl
    : `${healthUrl}?tenant=probe`;
  const headers = { 'Content-Type': 'application/json' };
  if (secret) headers['x-telegram-bot-api-secret-token'] = secret;

  const post = await fetch(probeUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ update_id: 0, message: null }),
  });
  const postBody = await post.text();
  console.log('\n--- POST probe (status', post.status, ') ---');
  console.log(postBody);

  if (info.result?.url && !info.result.url.startsWith(base)) {
    console.warn(
      '\n⚠️  Il webhook Telegram punta a un dominio diverso da WEBHOOK_BASE_URL:',
      info.result.url,
    );
  }
  if (secret && post.status === 401) {
    console.error(
      '\n❌ 401 Unauthorized: TELEGRAM_WEBHOOK_SECRET su Vercel non coincide con secret_token del webhook. Riesegui register-telegram-webhook.mjs.',
    );
  }
  if (!secret && health.webhookSecretRequired) {
    console.error(
      '\n❌ Su Vercel è configurato TELEGRAM_WEBHOOK_SECRET ma il probe non lo invia. Telegram deve usare lo stesso secret (register-telegram-webhook.mjs).',
    );
  }
}

process.exit(info.ok ? 0 : 1);
