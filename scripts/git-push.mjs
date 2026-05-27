#!/usr/bin/env node
/**
 * Bump v2.N in src/version.js, commit (v2.N — data ora — descrizione) e push.
 *
 * Uso:
 *   npm run push
 *   npm run push -- "Codici minori: foto e layout mobile"
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  bumpAppVersion,
  formatVersionCommitMessage,
  readAppVersionFromFile,
  writeAppVersionInFile,
} from './lib/versionCommitMessage.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const versionPath = path.join(root, 'src', 'version.js');

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd: root, encoding: 'utf8', ...opts });
  if (r.status !== 0) {
    const err = (r.stderr || r.stdout || '').trim();
    throw new Error(err || `${cmd} ${args.join(' ')} exit ${r.status}`);
  }
  return (r.stdout || '').trim();
}

function git(...args) {
  return run('git', args);
}

const description = process.argv.slice(2).join(' ').trim();

const versionText = readFileSync(versionPath, 'utf8');
const current = readAppVersionFromFile(versionText);
if (!current) {
  console.error('Impossibile leggere APP_VERSION da src/version.js');
  process.exit(1);
}

const next = bumpAppVersion(current);
const commitAt = new Date();
const message = formatVersionCommitMessage(next, description, commitAt);

writeFileSync(versionPath, writeAppVersionInFile(versionText, next), 'utf8');
console.log(`Versione: ${current} → ${next}`);
console.log(`Commit: ${message}`);

git('add', '-A');

const status = git('status', '--porcelain');
if (!status) {
  console.log('Nessuna modifica da committare (solo version.js già allineata?).');
  process.exit(0);
}

git('commit', '-m', message);
git('push');

console.log('Push completato.');
