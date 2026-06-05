/**
 * Seed demo PMA desk: autopresentati (in attesa / in carico) + in arrivo da centrale.
 * Eventi/missioni con indirizzi nel territorio di Lecco.
 *
 *   node scripts/seed-pma-desk-demo.mjs
 *   node scripts/seed-pma-desk-demo.mjs --pma-id <uuid>
 */

import { createRequire } from 'module';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const ESITO_TRASPORTA = 'Trasporta';
const STATO_MISSIONE = 'IN POSTO';
const STATI_STORICO = ['ALLERTARE', 'ALLERTATO', 'PARTITO', STATO_MISSIONE];

const EVENTI_LECCO = [
  {
    tipoEvento: 'Malore',
    dettaglioEvento: 'Gara podistica — crampi e lipotimia',
    indirizzo: 'Piazza del Duomo, 23900 Lecco LC',
    colore: 'Giallo',
  },
  {
    tipoEvento: 'Trauma',
    dettaglioEvento: 'Caduta da bici — contusione ginocchio',
    indirizzo: 'Via Roma, 18, 23900 Lecco LC',
    colore: 'Verde',
  },
];

const AUTO_PRESENTATI = [
  { nome: 'Giulia', cognome: 'Bianchi', sesso: 'F', eta: 24, statoPzPma: 'IN ATTESA', tipo: 'Crampi' },
  { nome: 'Marco', cognome: 'Colombo', sesso: 'M', eta: 31, statoPzPma: 'IN ATTESA', tipo: 'Distorsione caviglia' },
  { nome: 'Sara', cognome: 'Riva', sesso: 'F', eta: 19, statoPzPma: 'in carico', tipo: 'Nausea' },
  { nome: 'Luca', cognome: 'Ferrari', sesso: 'M', eta: 42, statoPzPma: 'in carico', tipo: 'Taglio mano' },
];

const IN_ARRIVO = [
  { nome: 'Elena', cognome: 'Lecco_1', sesso: 'F', eta: 55, eventoIdx: 0 },
  { nome: 'Paolo', cognome: 'Lecco_2', sesso: 'M', eta: 48, eventoIdx: 0 },
  { nome: 'Anna', cognome: 'Lecco_3', sesso: 'F', eta: 33, eventoIdx: 1 },
  { nome: 'Davide', cognome: 'Lecco_4', sesso: 'M', eta: 27, eventoIdx: 1 },
];

function parseEnvFile(filePath) {
  const env = {};
  if (!existsSync(filePath)) return env;
  for (const raw of readFileSync(filePath, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    let val = line.slice(eqIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  if (i === -1 || i + 1 >= process.argv.length) return '';
  return process.argv[i + 1].trim();
}

function newIdUnivoco() {
  return crypto.randomUUID();
}

function nextProgressiveId(prefix, items, fieldName) {
  let max = 0;
  for (const item of items) {
    const raw = item[fieldName] ?? item._docId ?? '';
    const match = String(raw).match(new RegExp(`^${prefix}(\\d+)$`, 'i'));
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  return `${prefix}${max + 1}`;
}

function buildStoricoInPosto() {
  const base = Date.now();
  const storico = {};
  STATI_STORICO.forEach((stato, i) => {
    storico[stato] = Timestamp.fromMillis(base - (STATI_STORICO.length - i) * 120_000);
  });
  return storico;
}

function emptyPmaScheda(extra = {}) {
  return {
    breve_descrizione: '',
    codice_colore: 'verde',
    apr: '',
    allergie: '',
    allergie_verifica: null,
    app: '',
    EO_GENERALE: [],
    EO_NEUROLOGICO: [],
    EO_CUTE: [],
    EO_TORACE: [],
    EO_ADDOME: [],
    EO_CAPO_COLLO: [],
    eo_note: '',
    parametri_vitali: [],
    prestazioni_sel: [],
    farmaci: [],
    rivalutazioni: [],
    lesioni: [],
    tipo_evento: '',
    dettaglio_evento: '',
    dimissione_esito: null,
    dimissione_note: '',
    infermiere_rif: '',
    medico_rif: '',
    ingresso_carico_at: null,
    ...extra,
  };
}

async function main() {
  const ENV = parseEnvFile(join(ROOT, '.env.local'));
  const tenant = (ENV.VITE_TENANT_ID ?? '').trim();
  if (!tenant) {
    console.error('Manca VITE_TENANT_ID in .env.local');
    process.exit(1);
  }

  let admin;
  try {
    admin = require('firebase-admin');
  } catch {
    console.error('firebase-admin mancante');
    process.exit(1);
  }
  if (!ENV.FIREBASE_SERVICE_ACCOUNT_JSON) {
    console.error('Manca FIREBASE_SERVICE_ACCOUNT_JSON');
    process.exit(1);
  }
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(ENV.FIREBASE_SERVICE_ACCOUNT_JSON)),
    });
  }
  const db = admin.firestore();

  const impSnap = await db.doc(`manifestazioni/${tenant}/settings/impostazioni`).get();
  const imp = impSnap.data() ?? {};
  const pmaList = (imp.pma ?? []).filter((p) => p?.id && p?.nome);
  const pmaIdArg = argValue('--pma-id');
  const pma =
    pmaList.find((p) => p.id === pmaIdArg) ??
    pmaList.find((p) => /resegup/i.test(p.nome)) ??
    pmaList[0];
  if (!pma) {
    console.error('Nessun PMA in impostazioni');
    process.exit(1);
  }
  const pmaId = String(pma.id).trim();
  const pmaNome = String(pma.nome).trim();

  const [evSnap, misSnap, mezSnap, pazSnap] = await Promise.all([
    db.collection(`manifestazioni/${tenant}/eventi`).get(),
    db.collection(`manifestazioni/${tenant}/missioni`).get(),
    db.collection(`manifestazioni/${tenant}/mezzi`).get(),
    db.collection(`manifestazioni/${tenant}/pazienti`).get(),
  ]);

  const rowsEventi = evSnap.docs.map((d) => ({ _docId: d.id, ...d.data() }));
  const rowsMissioni = misSnap.docs.map((d) => ({ _docId: d.id, ...d.data() }));
  const rowsPazienti = pazSnap.docs.map((d) => ({ _docId: d.id, ...d.data() }));
  const mezzi = mezSnap.docs.map((d) => d.id).filter(Boolean);
  if (!mezzi.length) {
    console.error('Nessun mezzo in anagrafica');
    process.exit(1);
  }

  const storicoStati = buildStoricoInPosto();
  const statoDa = storicoStati[STATO_MISSIONE];

  console.log(`\nTenant: ${tenant}`);
  console.log(`PMA: ${pmaNome} (${pmaId})\n`);

  /** @type {{ idEvento: string, idUnivocoEvento: string, idMissione: string, idUnivocoMis: string, mezzo: string }[]} */
  const trasporti = [];

  for (let ei = 0; ei < EVENTI_LECCO.length; ei += 1) {
    const evDef = EVENTI_LECCO[ei];
    const idEvento = nextProgressiveId('E', rowsEventi, 'idEvento');
    const idUnivocoEvento = newIdUnivoco();
    await db.collection(`manifestazioni/${tenant}/eventi`).add({
      manifestationId: tenant,
      idUnivoco: idUnivocoEvento,
      idEvento,
      apertura: FieldValue.serverTimestamp(),
      stato: true,
      indirizzo: evDef.indirizzo,
      tipoEvento: evDef.tipoEvento,
      dettaglioEvento: evDef.dettaglioEvento,
      colore: evDef.colore,
      noteEvento: 'Seed demo PMA desk — territorio Lecco',
      noteProvaSeedPma: true,
    });
    rowsEventi.push({ idEvento });
    console.log(`Evento ${idEvento} — ${evDef.tipoEvento} @ ${evDef.indirizzo}`);

    const mezzo = mezzi[ei % mezzi.length];
    const idMissione = nextProgressiveId('M', rowsMissioni, 'idMissione');
    const idUnivocoMis = newIdUnivoco();
    await db.collection(`manifestazioni/${tenant}/missioni`).add({
      manifestationId: tenant,
      idUnivoco: idUnivocoMis,
      idMissione,
      eventoIdUnivoco: idUnivocoEvento,
      eventoCorrelato: idEvento,
      mezzo,
      stato: STATO_MISSIONE,
      statoDa,
      storicoStati,
      pazienteAutopresentato: false,
      aperta: true,
      apertura: FieldValue.serverTimestamp(),
      noteProvaSeedPma: true,
    });
    rowsMissioni.push({ idMissione });
    await db.doc(`manifestazioni/${tenant}/mezzi/${mezzo}`).set(
      { manifestationId: tenant, statoMezzo: 'Non disponibile' },
      { merge: true },
    );
    trasporti.push({
      idEvento,
      idUnivocoEvento,
      idMissione,
      idUnivocoMis,
      mezzo,
    });
    console.log(`  Missione ${idMissione} → ${mezzo}`);
  }

  for (const p of AUTO_PRESENTATI) {
    const idPaziente = nextProgressiveId('P', rowsPazienti, 'idPaziente');
    const inCarico = p.statoPzPma === 'in carico';
    const scheda = emptyPmaScheda({
      breve_descrizione: `Autopresentato — ${p.tipo}`,
      tipo_evento: 'Manifestazione Lecco',
      dettaglio_evento: p.tipo,
      ...(inCarico ? { ingresso_carico_at: Timestamp.now() } : {}),
    });
    await db.collection(`manifestazioni/${tenant}/pazienti`).add({
      manifestationId: tenant,
      idUnivoco: newIdUnivoco(),
      idPaziente,
      eventoIdUnivoco: '',
      eventoCorrelato: '',
      aperta: true,
      apertura: Timestamp.now(),
      tipoPz: 'PMA',
      esito: '',
      stato: 'PMA',
      nome: p.nome,
      cognome: p.cognome,
      eta: p.eta,
      sesso: p.sesso,
      ospedaleDestinazione: pmaNome,
      destinazionePmaId: pmaId,
      pmaId,
      statoPzPma: p.statoPzPma,
      pmaScheda: scheda,
      notePaziente: 'Seed demo autopresentato PMA',
      noteProvaSeedPma: true,
    });
    rowsPazienti.push({ idPaziente });
    console.log(`Paziente ${idPaziente} — autopresentato ${p.statoPzPma} (${p.cognome})`);
  }

  for (const p of IN_ARRIVO) {
    const tr = trasporti[p.eventoIdx];
    const idPaziente = nextProgressiveId('P', rowsPazienti, 'idPaziente');
    await db.collection(`manifestazioni/${tenant}/pazienti`).add({
      manifestationId: tenant,
      idUnivoco: newIdUnivoco(),
      idPaziente,
      eventoIdUnivoco: tr.idUnivocoEvento,
      eventoCorrelato: tr.idEvento,
      aperta: true,
      apertura: Timestamp.now(),
      tipoPz: 'CENTRALE',
      esito: ESITO_TRASPORTA,
      stato: 'TRASPORTO',
      mezzo: tr.mezzo,
      idMissione: tr.idMissione,
      missioneIdUnivoco: tr.idUnivocoMis,
      nome: p.nome,
      cognome: p.cognome,
      eta: p.eta,
      sesso: p.sesso,
      ospedaleDestinazione: pmaNome,
      destinazionePmaId: pmaId,
      pmaId,
      statoPzPma: 'IN ARRIVO',
      percorsoCodiceMinore: false,
      notePaziente: `Trasporto verso PMA — ${EVENTI_LECCO[p.eventoIdx].indirizzo}`,
      noteProvaSeedPma: true,
    });
    rowsPazienti.push({ idPaziente });
    console.log(
      `Paziente ${idPaziente} — IN ARRIVO (${p.cognome}, ${tr.idMissione} / ${tr.idEvento})`,
    );
  }

  console.log('\n✅ Creati 8 pazienti PMA demo (4 autopresentati + 4 in arrivo).\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
