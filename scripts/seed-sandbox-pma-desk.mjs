/**
 * Dati di prova per desk PMA (solo tenant SANDBOX).
 * Crea evento + missione + pazienti IN ARRIVO e IN CARICO.
 *
 *   node scripts/seed-sandbox-pma-desk.mjs
 *   node scripts/seed-sandbox-pma-desk.mjs --tenant p8L0HKL60iRwCDFprKAw
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

const EMPTY_PMA_SCHEDA = {
  breve_descrizione: 'Paziente prova sandbox — in carico',
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
  ecg_cloudinary_url: null,
  farmaci: [],
  rivalutazioni: [],
  lesioni: [],
  tipo_evento: '',
  dettaglio_evento: '',
  dimissione_esito: null,
  dimissione_note: '',
  affidatario_nome: '',
  affidatario_cognome: '',
  affidatario_legame: '',
  firma_paziente_base64: null,
  dimissione_firma_medico_base64: null,
  dimesso_at: null,
  invio_ps_missione_areu: null,
  invio_ps_data_ora: null,
  invio_ps_mezzo: '',
  invio_ps_ospedale: '',
  invio_ps_codice_trasporto: null,
  invio_ps_note: '',
  invio_ps_soreu_ora_missione: null,
  invio_ps_soreu_numero_missione: '',
  invio_ps_soreu_accompagnato: ['NO'],
  invio_ps_soreu_codice: '',
  infermiere_rif: '',
  medico_rif: '',
  ingresso_carico_at: null,
};

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

function resolveSandboxTenant(env) {
  const fromArg = argValue('--tenant');
  if (fromArg) return fromArg;
  const tenantFile = join(ROOT, 'sandbox', 'TENANT_ID');
  if (existsSync(tenantFile)) {
    return readFileSync(tenantFile, 'utf8').trim();
  }
  throw new Error(
    'Tenant sandbox non trovato. Usa --tenant <id> o crea sandbox/TENANT_ID (npm run sandbox:create sul branch sandbox).',
  );
}

async function main() {
  const ENV = parseEnvFile(join(ROOT, '.env.local'));
  const prodTenant = (ENV.VITE_TENANT_ID ?? '').trim();
  const tenant = resolveSandboxTenant(ENV);

  if (prodTenant && tenant === prodTenant) {
    console.error(
      `❌  Bloccato: tenant ${tenant} coincide con VITE_TENANT_ID (produzione). Usa il tenant sandbox.`,
    );
    process.exit(1);
  }

  let admin;
  try {
    admin = require('firebase-admin');
  } catch {
    console.error('firebase-admin mancante. npm install');
    process.exit(1);
  }

  let serviceAccount;
  if (ENV.FIREBASE_SERVICE_ACCOUNT_JSON) {
    serviceAccount = JSON.parse(ENV.FIREBASE_SERVICE_ACCOUNT_JSON);
  } else {
    console.error('Manca FIREBASE_SERVICE_ACCOUNT_JSON in .env.local');
    process.exit(1);
  }

  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
  const db = admin.firestore();

  const impSnap = await db.doc(`manifestazioni/${tenant}/settings/impostazioni`).get();
  if (!impSnap.exists) {
    console.error(`Impostazioni assenti per tenant ${tenant}`);
    process.exit(1);
  }
  const imp = impSnap.data();
  const pmaList = (imp.pma ?? []).filter((p) => p?.id && p?.nome);
  if (pmaList.length === 0) {
    console.error('Nessun PMA in impostazioni sandbox. Configura almeno un PMA.');
    process.exit(1);
  }
  const pma = pmaList[0];
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
  const mezziSigle = mezSnap.docs.map((d) => d.id).filter(Boolean);
  if (mezziSigle.length === 0) {
    console.error('Nessun mezzo nel tenant sandbox.');
    process.exit(1);
  }
  const mezzo = mezziSigle[0];

  const storicoStati = buildStoricoInPosto();
  const statoDa = storicoStati[STATO_MISSIONE];
  const idEvento = nextProgressiveId('E', rowsEventi, 'idEvento');
  const idUnivocoEvento = newIdUnivoco();
  const idMissione = nextProgressiveId('M', rowsMissioni, 'idMissione');
  const idUnivocoMis = newIdUnivoco();

  console.log(`\n🧪 Seed PMA desk — SOLO tenant sandbox: ${tenant}`);
  console.log(`   PMA: ${pmaNome} (${pmaId})`);
  if (prodTenant) console.log(`   Produzione (non toccata): ${prodTenant}\n`);

  const evRef = await db.collection(`manifestazioni/${tenant}/eventi`).add({
    manifestationId: tenant,
    idUnivoco: idUnivocoEvento,
    idEvento,
    apertura: FieldValue.serverTimestamp(),
    stato: true,
    indirizzo: 'Via prova sandbox PMA, 1',
    tipoEvento: 'Trauma',
    dettaglioEvento: 'Seed sandbox — trasporto verso PMA',
    colore: 'Giallo',
    noteEvento: 'Creato da seed-sandbox-pma-desk (solo sandbox)',
    noteProvaSandbox: true,
  });
  console.log(`Evento ${idEvento}`);

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
    noteProvaSandbox: true,
  });
  await db.doc(`manifestazioni/${tenant}/mezzi/${mezzo}`).set(
    { manifestationId: tenant, statoMezzo: 'Non disponibile' },
    { merge: true },
  );
  console.log(`Missione ${idMissione} → ${mezzo} [${STATO_MISSIONE}]`);

  const arrivoNames = [
    { nome: 'Sandbox', cognome: 'In Arrivo 1' },
    { nome: 'Sandbox', cognome: 'In Arrivo 2' },
  ];

  for (const { nome, cognome } of arrivoNames) {
    const idPaziente = nextProgressiveId('P', rowsPazienti, 'idPaziente');
    const idUnivocoP = newIdUnivoco();
    await db.collection(`manifestazioni/${tenant}/pazienti`).add({
      manifestationId: tenant,
      idUnivoco: idUnivocoP,
      idPaziente,
      eventoIdUnivoco: idUnivocoEvento,
      eventoCorrelato: idEvento,
      aperta: true,
      apertura: Timestamp.now(),
      tipoPz: 'CENTRALE',
      esito: ESITO_TRASPORTA,
      stato: 'TRASPORTO',
      mezzo,
      idMissione,
      missioneIdUnivoco: idUnivocoMis,
      nome,
      cognome,
      eta: 28,
      sesso: 'M',
      ospedaleDestinazione: pmaNome,
      destinazionePmaId: pmaId,
      pmaId,
      statoPzPma: 'IN ARRIVO',
      percorsoCodiceMinore: false,
      notePaziente: 'Prova operatori PMA — in arrivo',
      noteProvaSandbox: true,
    });
    rowsPazienti.push({ idPaziente });
    console.log(`Paziente ${idPaziente} — IN ARRIVO (${cognome})`);
  }

  const idPazienteCarico = nextProgressiveId('P', rowsPazienti, 'idPaziente');
  const schedaCarico = {
    ...EMPTY_PMA_SCHEDA,
    ingresso_carico_at: Timestamp.now(),
  };
  await db.collection(`manifestazioni/${tenant}/pazienti`).add({
    manifestationId: tenant,
    idUnivoco: newIdUnivoco(),
    idPaziente: idPazienteCarico,
    eventoIdUnivoco: '',
    eventoCorrelato: '',
    aperta: true,
    apertura: Timestamp.now(),
    tipoPz: 'PMA',
    esito: '',
    stato: 'in carico',
    nome: 'Sandbox',
    cognome: 'In Carico Prova',
    eta: 35,
    sesso: 'F',
    pmaId,
    destinazionePmaId: pmaId,
    ospedaleDestinazione: pmaNome,
    statoPzPma: 'in carico',
    pmaScheda: schedaCarico,
    notePaziente: 'Prova operatori PMA — già in carico',
    noteProvaSandbox: true,
  });
  console.log(`Paziente ${idPazienteCarico} — in carico (autopresentato PMA)`);

  console.log('\n✅ Seed sandbox completato. Produzione non scritta.\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
