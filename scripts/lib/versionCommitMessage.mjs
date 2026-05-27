/** @param {Date} [date] */
export function formatCommitDateTime(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** @param {string} version es. v2.11 */
export function parseAppVersion(version) {
  const m = String(version ?? '').trim().match(/^v2\.(\d+)$/i);
  if (!m) return null;
  return { major: 2, minor: Number(m[1]), label: `v2.${m[1]}` };
}

export function bumpAppVersion(current) {
  const parsed = parseAppVersion(current);
  const nextMinor = parsed ? parsed.minor + 1 : 1;
  return `v2.${nextMinor}`;
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
  /export const APP_VERSION = '(v2\.\d+)';/;

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
