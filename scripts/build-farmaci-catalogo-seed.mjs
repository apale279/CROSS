#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const csvPath = join(root, 'Prompt_local', 'elenco_farmaci_pma.csv');
const outPath = join(root, 'src', 'pma', 'lib', 'farmaciCatalogoSeed.json');

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

const raw = readFileSync(csvPath, 'utf8');
const lines = raw.split(/\r?\n/).filter((l) => l.trim());
const rows = [];

for (let i = 1; i < lines.length; i++) {
  const cols = parseCsvLine(lines[i]);
  const nome = String(cols[0] ?? '').trim();
  const dosRaw = String(cols[1] ?? '').trim();
  if (!nome) continue;
  const dosaggi = dosRaw
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  rows.push({ nome, dosaggi, via: 'EV' });
}

writeFileSync(outPath, `${JSON.stringify(rows, null, 2)}\n`, 'utf8');
console.log(`Scritti ${rows.length} farmaci in ${outPath}`);
