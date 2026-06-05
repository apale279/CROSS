/**
 * Limita il rate delle scritture Firestore durante lo stress test.
 * Default: ~25s tra scritture → suite ~20–35 min a seconda del numero di operazioni.
 *
 * Override via env (playwright.stress.config.js):
 *   STRESS_WRITE_DELAY_MS, STRESS_BETWEEN_TESTS_MS,
 *   STRESS_CLEANUP_MAX, STRESS_CLEANUP_DELAY_MS
 */
export const STRESS_WRITE_DELAY_MS = Number(process.env.STRESS_WRITE_DELAY_MS ?? 25_000);
export const STRESS_BETWEEN_TESTS_MS = Number(process.env.STRESS_BETWEEN_TESTS_MS ?? 30_000);
export const STRESS_CLEANUP_MAX = Number(process.env.STRESS_CLEANUP_MAX ?? 3);
export const STRESS_CLEANUP_DELAY_MS = Number(process.env.STRESS_CLEANUP_DELAY_MS ?? 15_000);
export const STRESS_SYNC_MS = Number(process.env.STRESS_SYNC_MS ?? 2_000);
export const STRESS_QUOTA_RETRY_MS = Number(process.env.STRESS_QUOTA_RETRY_MS ?? 90_000);
export const STRESS_QUOTA_MAX_RETRIES = Number(process.env.STRESS_QUOTA_MAX_RETRIES ?? 5);
export const STRESS_SUITE_WARMUP_MS = Number(process.env.STRESS_SUITE_WARMUP_MS ?? 60_000);

let lastWriteAt = 0;
let writeCount = 0;
let suiteStartedAt = 0;

export function markSuiteStart() {
  suiteStartedAt = Date.now();
  writeCount = 0;
  lastWriteAt = 0;
}

export function stressStats() {
  const elapsedMin = suiteStartedAt ? ((Date.now() - suiteStartedAt) / 60_000).toFixed(1) : '?';
  return { writeCount, elapsedMin };
}

/** Pausa dopo un'operazione che scrive su Firestore. */
export async function dopoScrittura(page, label = '') {
  writeCount += 1;
  const now = Date.now();
  const sinceLast = lastWriteAt ? now - lastWriteAt : STRESS_WRITE_DELAY_MS;
  const wait = Math.max(0, STRESS_WRITE_DELAY_MS - sinceLast);
  if (wait > 0) {
    const stats = stressStats();
    console.log(
      `   ⏳ ${Math.round(wait / 1000)}s throttle${label ? ` — ${label}` : ''} ` +
        `(scrittura #${writeCount}, suite ${stats.elapsedMin} min)`,
    );
    await page.waitForTimeout(wait);
  }
  await page.waitForTimeout(STRESS_SYNC_MS);
  lastWriteAt = Date.now();
}

let quotaHits = 0;

/** Attesa iniziale + backoff se Firestore risponde 429 / Quota exceeded. */
export async function attendiQuotaFirestore(page, reason = 'quota') {
  quotaHits += 1;
  const wait = STRESS_QUOTA_RETRY_MS * Math.min(quotaHits, 3);
  console.log(
    `   🔄 Quota Firestore (${reason}) — attesa ${Math.round(wait / 1000)}s ` +
      `(tentativo quota #${quotaHits})`,
  );
  await page.waitForTimeout(wait);
}

export async function warmupSuite(page) {
  if (STRESS_SUITE_WARMUP_MS > 0) {
    console.log(`   🌡 Warmup suite ${Math.round(STRESS_SUITE_WARMUP_MS / 1000)}s (rate limit Firestore)`);
    await page.waitForTimeout(STRESS_SUITE_WARMUP_MS);
  }
}

/** Pausa tra un test e il successivo (nessuna scrittura). */
export async function pausaTraTest(page, testTitle = '') {
  if (STRESS_BETWEEN_TESTS_MS <= 0) return;
  console.log(
    `   ⏸ Pausa ${Math.round(STRESS_BETWEEN_TESTS_MS / 1000)}s prima del prossimo test` +
      (testTitle ? ` (dopo: ${testTitle})` : ''),
  );
  await page.waitForTimeout(STRESS_BETWEEN_TESTS_MS);
}
