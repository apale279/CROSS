const EMOJI_POOL = ['🚑', '🚒', '🚗', '🏍️', '🚐', '🛻', '🚙', '🚁', '🛵', '⚕️', '🏥', '📍'];

/** Emoji stabile derivata dal nome (per migrazione stringhe → oggetti). */
export function emojiFromSeed(seed) {
  const s = String(seed ?? '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return EMOJI_POOL[Math.abs(h) % EMOJI_POOL.length];
}

/** Primo grapheme (emoji singola in UI). */
export function sanitizeEmoji(value) {
  const s = String(value ?? '').trim();
  if (!s) return '';
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const seg = [...new Intl.Segmenter().segment(s)].map((x) => x.segment);
    return seg[0] ?? '';
  }
  return [...s][0] ?? '';
}

export function normalizeTipiMezzo(raw) {
  const list = Array.isArray(raw) ? raw : [];
  const out = [];
  const seen = new Set();

  for (const item of list) {
    if (typeof item === 'string') {
      const nome = item.trim();
      if (!nome || seen.has(nome.toLowerCase())) continue;
      seen.add(nome.toLowerCase());
      out.push({ nome, emoji: emojiFromSeed(nome) });
      continue;
    }
    if (item && typeof item === 'object') {
      const nome = String(item.nome ?? item.name ?? '').trim();
      if (!nome || seen.has(nome.toLowerCase())) continue;
      seen.add(nome.toLowerCase());
      const emoji = sanitizeEmoji(item.emoji) || emojiFromSeed(nome);
      out.push({ nome, emoji });
    }
  }
  return out;
}

export function emojiForTipoMezzo(tipo, tipiRaw) {
  const nome = String(tipo ?? '').trim();
  if (!nome) return '📍';
  const hit = normalizeTipiMezzo(tipiRaw).find((t) => t.nome === nome);
  return hit?.emoji || emojiFromSeed(nome);
}

export const DEFAULT_TIPI_MEZZO = normalizeTipiMezzo([
  'Ambulanza',
  'Auto medica',
  'Moto medica',
  'Unità mobile',
]);
