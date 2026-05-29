#!/usr/bin/env node
/**
 * Guardrail: verifica che moduli critici (mezzo/missione/evento) abbiano
 * import ed export necessari — evita ReferenceError in produzione.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function read(relPath) {
  return readFileSync(join(root, relPath), 'utf8');
}

/** @type {{ file: string, mustInclude?: string[], mustNotInclude?: string[] }[]} */
const checks = [
  {
    file: 'src/hooks/useOperativoDashboardData.js',
    mustInclude: [
      "import { patchEvento } from '../services/eventiService'",
      'patchEvento(manifestationId',
      'operativoAutoCloseSospeso',
    ],
  },
  {
    file: 'src/services/missioniService.js',
    mustInclude: ['missioniRientroAperteSuMezzo'],
    mustNotInclude: ['export async function chiudiMissioniAperteSuMezzo'],
  },
  {
    file: 'src/services/mezzoDisponibileService.js',
    mustInclude: [
      'export async function chiudiMissioniAperteSuMezzo',
      'export async function patchMezzoStatoMezzo',
      'fieldsChiusuraMissioneSuEventoForzato',
    ],
  },
  {
    file: 'src/services/mezziService.js',
    mustInclude: ['import { newIdUnivoco }'],
    mustNotInclude: ['chiudiMissioniAperteSuMezzo', 'patchMezzoStatoMezzo'],
  },
  {
    file: 'src/services/eventoAutoCloseService.js',
    mustInclude: [
      "import { patchEvento } from './eventiService'",
      'operativoAutoCloseSospeso',
    ],
  },
  {
    file: 'src/components/eventi/EventoScheda.jsx',
    mustInclude: ['riapriEventoOperatore', 'patchEvento(manifestazioneId'],
    mustNotInclude: ['patchEvento(manifestationId', 'riapriEventoOperatore(manifestationId'],
  },
  {
    file: 'src/components/mezzi/MezzoScheda.jsx',
    mustInclude: ['mezzoDisponibileService', 'confirmMezzoDisponibileLiberaMissioni'],
  },
  {
    file: 'src/pages/MezziPage.jsx',
    mustInclude: ['mezzoDisponibileService', 'patchStatoMezzo'],
  },
];

let failed = false;

for (const { file, mustInclude = [], mustNotInclude = [] } of checks) {
  let content;
  try {
    content = read(file);
  } catch (err) {
    console.error(`FAIL ${file}: file non trovato (${err.message})`);
    failed = true;
    continue;
  }

  for (const needle of mustInclude) {
    if (!content.includes(needle)) {
      console.error(`FAIL ${file}: manca "${needle}"`);
      failed = true;
    }
  }
  for (const needle of mustNotInclude) {
    if (content.includes(needle)) {
      console.error(`FAIL ${file}: presente vietato "${needle}"`);
      failed = true;
    }
  }
}

if (failed) {
  console.error('\nverify:critical — controlli falliti.');
  process.exit(1);
}

console.log('verify:critical — OK');
