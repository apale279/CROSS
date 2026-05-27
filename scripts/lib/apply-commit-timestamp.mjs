#!/usr/bin/env node
/**
 * Hook prepare-commit-msg: v2.N — descrizione  →  v2.N — YYYY-MM-DD HH:mm — descrizione
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { formatCommitDateTime } from './versionCommitMessage.mjs';

const file = process.argv[2];
if (!file) process.exit(0);

const HAS_TS = /\d{4}-\d{2}-\d{2} \d{2}:\d{2}/;
const VERSION_LINE = /^(v2\.\d+) — /i;

let text = readFileSync(file, 'utf8');
const lines = text.split(/\r?\n/);
const first = lines[0] ?? '';

if (!VERSION_LINE.test(first) || HAS_TS.test(first)) {
  process.exit(0);
}

const m = first.match(/^(v2\.\d+) — (.+)$/i);
if (!m) process.exit(0);

const ts = formatCommitDateTime(new Date());
lines[0] = `${m[1]} — ${ts} — ${m[2]}`;
writeFileSync(file, lines.join('\n'), 'utf8');
