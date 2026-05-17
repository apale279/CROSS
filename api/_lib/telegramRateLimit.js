export function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Esegue fn su ogni elemento con pausa tra le chiamate (rate limit Telegram ~30/s).
 */
export async function forEachRateLimited(items, fn, { delayMs = 40 } = {}) {
  const results = [];
  for (let i = 0; i < items.length; i += 1) {
    results.push(await fn(items[i], i));
    if (i < items.length - 1) await sleep(delayMs);
  }
  return results;
}
