/** @param {Date} [date] */
export function formatCommitDateTime(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** @param {string} version es. v2.11 o v3 / v3.1 */
export function parseAppVersion(version) {
  const s = String(version ?? '').trim();
  const m2 = s.match(/^v2\.(\d+)$/i);
  if (m2) return { major: 2, minor: Number(m2[1]), label: `v2.${m2[1]}` };
  const m3 = s.match(/^v3(?:\.(\d+))?$/i);
  if (m3) {
    const patch = m3[1] != null ? Number(m3[1]) : 0;
    return { major: 3, minor: patch, label: m3[1] != null ? `v3.${m3[1]}` : 'v3' };
  }
  return null;
}

export function bumpAppVersion(current) {
  const parsed = parseAppVersion(current);
  if (!parsed) return 'v3.1';
  if (parsed.major === 3) {
    return `v3.${parsed.minor + 1}`;
  }
  return `v2.${parsed.minor + 1}`;
}

/**
 * Messaggio commit: v2.N — YYYY-MM-DD HH:mm — descrizione
 * @param {string} version
 * @param {string} [description]
 * @param {Date} [date]
 */
export function formatVersionCommitMessage(version, description = '', date = new Date()) {
  const ts = formatCommitDateTime(date);
  const desc = String(description ?? '').trim();
  if (desc) return `${version} — ${ts} — ${desc}`;
  return `${version} — ${ts}`;
}

const VERSION_FILE_RE =
  /export const APP_VERSION = '(v(?:2\.\d+|3(?:\.\d+)?))';/;

export function readAppVersionFromFile(versionFileText) {
  const m = versionFileText.match(VERSION_FILE_RE);
  return m?.[1] ?? null;
}

export function writeAppVersionInFile(versionFileText, nextVersion) {
  if (!VERSION_FILE_RE.test(versionFileText)) {
    throw new Error('APP_VERSION non trovato in src/version.js');
  }
  return versionFileText.replace(VERSION_FILE_RE, `export const APP_VERSION = '${nextVersion}';`);
}
