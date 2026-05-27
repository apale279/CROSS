/**
 * 5 eventi di prova per dashboard centrale:
 * - 1–2 pazienti ed 1–2 missioni per evento (random)
 * - missioni al massimo in stato «IN POSTO»
 *
 * npm run seed:prova
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  query,
  limit,
  setDoc,
  doc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const ESITO_TRASPORTA = 'Trasporta';
const STATO_MISSIONE = 'IN POSTO';
const STATI_STORICO = ['ALLERTARE', 'ALLERTATO', 'PARTITO', STATO_MISSIONE];

const TIPI_EVENTO = ['Malore', 'Trauma', 'Intossicazione', 'Caduta', 'Altro'];
const COLORI = ['Bianco', 'Verde', 'Giallo', 'Rosso'];
const NOMI_EVENTO = [
  'Prova centrale A',
  'Prova centrale B',
  'Prova centrale C',
  'Prova centrale D',
  'Prova centrale E',
];

function loadDotEnv() {
  for (const p of [join(ROOT, '.env'), join(ROOT, '.env.local')]) {
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i === -1) continue;
      const key = t.slice(0, i).trim();
      let val = t.slice(i + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
    break;
  }
}

loadDotEnv();

function paths(tenant) {
  const base = ['manifestazioni', tenant];
  return {
    eventi: [...base, 'eventi'],
    missioni: [...base, 'missioni'],
    mezzi: [...base, 'mezzi'],
    pazienti: [...base, 'pazienti'],
  };
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

function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function resolveTenant(db) {
  const envTenant = (process.env.VITE_TENANT_ID ?? '').trim();
  if (envTenant) return envTenant;
  const snap = await getDocs(query(collection(db, 'manifestazioni'), limit(2)));
  if (snap.empty) throw new Error('Nessuna manifestazione. Imposta VITE_TENANT_ID.');
  if (snap.size > 1) throw new Error('Più manifestazioni: imposta VITE_TENANT_ID.');
  return snap.docs[0].id;
}

function buildStoricoInPosto() {
  const base = Date.now();
  const storico = {};
  STATI_STORICO.forEach((stato, i) => {
    storico[stato] = Timestamp.fromMillis(base - (STATI_STORICO.length - i) * 120_000);
  });
  return storico;
}

async function main() {
  const apiKey = process.env.VITE_FIREBASE_API_KEY;
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
  if (!apiKey || !projectId) {
    console.error('Manca .env con credenziali Firebase (VITE_FIREBASE_*).');
    process.exit(1);
  }

  const app = initializeApp({
    apiKey,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
  });
  const db = getFirestore(app);
  const tenant = await resolveTenant(db);
  const p = paths(tenant);

  const [evSnap, misSnap, mezSnap, pazSnap] = await Promise.all([
    getDocs(collection(db, ...p.eventi)),
    getDocs(collection(db, ...p.missioni)),
    getDocs(collection(db, ...p.mezzi)),
    getDocs(collection(db, ...p.pazienti)),
  ]);

  let rowsEventi = evSnap.docs.map((d) => ({ _docId: d.id, ...d.data() }));
  let rowsMissioni = misSnap.docs.map((d) => ({ _docId: d.id, ...d.data() }));
  let rowsPazienti = pazSnap.docs.map((d) => ({ _docId: d.id, ...d.data() }));
  const mezziSigle = mezSnap.docs.map((d) => d.id).filter(Boolean);

  if (mezziSigle.length === 0) {
    console.error('Nessun mezzo in anagrafica. Crea almeno un mezzo prima del seed.');
    process.exit(1);
  }

  const poolMezzi = shuffle(mezziSigle);
  let mezzoIx = 0;
  const pickMezzo = () => {
    const sigla = poolMezzi[mezzoIx % poolMezzi.length];
    mezzoIx += 1;
    return sigla;
  };

  const storicoStati = buildStoricoInPosto();
  const statoDa = storicoStati[STATO_MISSIONE];

  console.log(`Tenant: ${tenant} | 5 eventi, missioni max «${STATO_MISSIONE}»\n`);

  for (let ei = 0; ei < 5; ei += 1) {
    const numPazienti = randInt(1, 2);
    const numMissioni = randInt(1, 2);
    const idEvento = nextProgressiveId('E', rowsEventi, 'idEvento');
    const idUnivocoEvento = newIdUnivoco();

    const payloadEvento = {
      manifestationId: tenant,
      idUnivoco: idUnivocoEvento,
      idEvento,
      apertura: serverTimestamp(),
      stato: true,
      indirizzo: `[Prova] Via test ${randInt(1, 99)}, settore ${String.fromCharCode(65 + ei)}`,
      tipoEvento: TIPI_EVENTO[ei % TIPI_EVENTO.length],
      dettaglioEvento: `Seed prova centrale • ${NOMI_EVENTO[ei]}`,
      colore: COLORI[randInt(0, COLORI.length - 1)],
      noteEvento: 'Creato da seed:prova (dashboard centrale)',
      noteProvaSeed: true,
    };

    const evRef = await addDoc(collection(db, ...p.eventi), payloadEvento);
    rowsEventi.push({ _docId: evRef.id, ...payloadEvento });
    console.log(`Evento ${idEvento} — ${NOMI_EVENTO[ei]} (${numMissioni} mis., ${numPazienti} pz.)`);

    /** @type {{ idMissione: string, idUnivoco: string, sigla: string }[]} */
    const missioniEvento = [];
    for (let mi = 0; mi < numMissioni; mi += 1) {
      const sigla = pickMezzo();
      const idMissione = nextProgressiveId('M', rowsMissioni, 'idMissione');
      const idUnivocoMis = newIdUnivoco();

      await addDoc(collection(db, ...p.missioni), {
        manifestationId: tenant,
        idUnivoco: idUnivocoMis,
        idMissione,
        eventoIdUnivoco: idUnivocoEvento,
        eventoCorrelato: idEvento,
        mezzo: sigla,
        stato: STATO_MISSIONE,
        statoDa,
        storicoStati,
        pazienteAutopresentato: false,
        aperta: true,
        apertura: serverTimestamp(),
        noteProvaSeed: true,
      });
      rowsMissioni.push({ _docId: idMissione, idMissione, idUnivoco: idUnivocoMis });
      await setDoc(
        doc(db, ...p.mezzi, sigla),
        { manifestationId: tenant, statoMezzo: 'Non disponibile' },
        { merge: true },
      );
      missioniEvento.push({ idMissione, idUnivoco: idUnivocoMis, sigla });
      console.log(`  Missione ${idMissione} → ${sigla} [${STATO_MISSIONE}]`);
    }

    for (let pi = 0; pi < numPazienti; pi += 1) {
      const idPaziente = nextProgressiveId('P', rowsPazienti, 'idPaziente');
      const idUnivocoP = newIdUnivoco();
      const mis = missioniEvento[pi % missioniEvento.length];
      const trasporta = pi === 0 || Math.random() > 0.4;

      await addDoc(collection(db, ...p.pazienti), {
        manifestationId: tenant,
        idUnivoco: idUnivocoP,
        idPaziente,
        eventoIdUnivoco: idUnivocoEvento,
        eventoCorrelato: idEvento,
        aperta: true,
        apertura: Timestamp.now(),
        esito: trasporta ? ESITO_TRASPORTA : 'Non trasporta',
        stato: trasporta ? 'TRASPORTO' : 'ATTESA',
        mezzo: trasporta ? mis.sigla : '',
        idMissione: trasporta ? mis.idMissione : '',
        missioneIdUnivoco: trasporta ? mis.idUnivoco : '',
        nome: 'Prova',
        cognome: `${idEvento}_Pz${pi + 1}`,
        eta: randInt(18, 65),
        sesso: Math.random() > 0.5 ? 'M' : 'F',
        notePaziente: `Seed prova • ${NOMI_EVENTO[ei]}`,
        noteProvaSeed: true,
      });
      rowsPazienti.push({ idPaziente });
      console.log(
        `  Paziente ${idPaziente} — ${trasporta ? ESITO_TRASPORTA + ` (${mis.sigla})` : 'Non trasporta'}`,
      );
    }
  }

  console.log('\nOK — 5 eventi di prova creati.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
