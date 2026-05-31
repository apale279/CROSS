import { FieldValue } from 'firebase-admin/firestore';
import { pazienteSuMissione } from './pazienteMissionMatch.js';

const ESITO_TRASPORTA = 'Trasporta';

const STATO_PZ_PMA = {
  IN_ARRIVO: 'IN ARRIVO',
  IN_ATTESA: 'IN ATTESA',
  IN_CARICO: 'in carico',
  DIMESSO: 'DIMESSO',
};

const EMPTY_PMA_SCHEDA = {
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
  infermiere_rif: '',
  medico_rif: '',
  ingresso_carico_at: null,
};

function coloreSanitarioToPmaCodice(codice) {
  const m = {
    Bianco: 'bianco',
    Verde: 'verde',
    Giallo: 'giallo',
    Rosso: 'rosso',
  };
  return m[String(codice ?? '').trim()] ?? null;
}

function seedFromPazienteEvento(paziente, evento) {
  const seed = {};
  if (evento) {
    seed.tipo_evento = String(evento.tipoEvento ?? '').trim();
    seed.dettaglio_evento = String(evento.dettaglioEvento ?? '').trim();
  }
  const fromMsb = coloreSanitarioToPmaCodice(paziente.codiceColoreSanitario);
  if (fromMsb) seed.codice_colore = fromMsb;
  return seed;
}

function statoPzPmaInArrivoIfAllowedAdmin(paziente) {
  const cur = String(paziente?.statoPzPma ?? '').trim();
  if (
    cur === STATO_PZ_PMA.DIMESSO ||
    cur === STATO_PZ_PMA.IN_CARICO ||
    cur === STATO_PZ_PMA.IN_ATTESA
  ) {
    return null;
  }
  return STATO_PZ_PMA.IN_ARRIVO;
}

function pazienteCollegatoAMissione(p, missione) {
  return (
    pazienteSuMissione(p, missione) &&
    p.esito === ESITO_TRASPORTA &&
    String(p.destinazionePmaId ?? '').trim()
  );
}

/** Allinea admin sync al client `patchPazienteArrivatoHConPma`. */
export function buildArrivatoHPatchAdmin(paziente, evento = null) {
  if (paziente.esito !== ESITO_TRASPORTA || paziente.stato === 'ARRIVATO H') return null;

  const patch = {
    stato: 'ARRIVATO H',
    arrivatoHAt: FieldValue.serverTimestamp(),
    aperta: false,
  };

  let initPmaScheda = false;
  let pmaSchedaSeed = null;

  const pmaDest = String(paziente.destinazionePmaId ?? '').trim();
  if (pmaDest) {
    const cur = String(paziente.statoPzPma ?? '').trim();
    if (
      cur !== STATO_PZ_PMA.DIMESSO &&
      cur !== STATO_PZ_PMA.IN_CARICO &&
      cur !== STATO_PZ_PMA.IN_ATTESA
    ) {
      patch.statoPzPma = STATO_PZ_PMA.IN_ARRIVO;
    }
    patch.pmaId = paziente.pmaId ?? pmaDest;
    if (!paziente.pmaScheda) {
      initPmaScheda = true;
      pmaSchedaSeed = seedFromPazienteEvento(paziente, evento);
    }
  }

  return { patch, initPmaScheda, pmaSchedaSeed };
}

/** Inizializza `pmaScheda` solo se assente (path puntati, senza sovrascrivere). */
export async function initPmaSchedaIfMissingAdmin(db, tenantId, docId, seed = null) {
  if (!db || !tenantId || !docId) return;
  const ref = db.collection('manifestazioni').doc(tenantId).collection('pazienti').doc(docId);
  const merged = { ...EMPTY_PMA_SCHEDA, ...(seed && typeof seed === 'object' ? seed : {}) };

  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists || snap.data()?.pmaScheda) return;
    const initFields = {};
    for (const [key, value] of Object.entries(merged)) {
      initFields[`pmaScheda.${key}`] = value;
    }
    transaction.update(ref, initFields);
  });
}

export async function applyArrivatoHPatchAdminTransaction(db, tenantId, docId, evento = null) {
  if (!db || !tenantId || !docId) return;
  const ref = db.collection('manifestazioni').doc(tenantId).collection('pazienti').doc(docId);
  let initSeed = null;

  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) return;
    const p = { _docId: snap.id, ...snap.data() };
    const result = buildArrivatoHPatchAdmin(p, evento);
    if (!result?.patch) return;
    transaction.update(ref, result.patch);
    if (result.initPmaScheda) initSeed = result.pmaSchedaSeed;
  });

  if (initSeed !== null) {
    await initPmaSchedaIfMissingAdmin(db, tenantId, docId, initSeed);
  }
}

export async function applyDirettoHPatchAdminTransaction(
  db,
  tenantId,
  docId,
  evento = null,
  missione = null,
) {
  if (!db || !tenantId || !docId) return false;
  const ref = db.collection('manifestazioni').doc(tenantId).collection('pazienti').doc(docId);
  let initSeed = null;
  let updated = false;

  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) return;
    const p = { _docId: snap.id, ...snap.data() };
    const patch = buildDirettoHPatchAdmin(p, missione);
    if (!patch) return;
    transaction.update(ref, patch);
    updated = true;
    if (!p.pmaScheda) initSeed = seedFromPazienteEvento(p, evento);
  });

  if (initSeed !== null) {
    await initPmaSchedaIfMissingAdmin(db, tenantId, docId, initSeed);
  }
  return updated;
}

/** Allinea admin sync al client `syncPazientiPmaOnDirettoH`. */
export function buildDirettoHPatchAdmin(paziente, missione = null) {
  if (paziente.esito !== ESITO_TRASPORTA) return null;
  if (!String(paziente.destinazionePmaId ?? '').trim()) return null;
  if (missione && !pazienteCollegatoAMissione(paziente, missione)) return null;
  const nextStato = statoPzPmaInArrivoIfAllowedAdmin(paziente);
  if (!nextStato) return null;
  return {
    tipoPz: paziente.tipoPz ?? 'CENTRALE',
    pmaId: paziente.pmaId ?? paziente.destinazionePmaId ?? '',
    statoPzPma: nextStato,
  };
}

/** Come client `pazienteEsclusoDaSyncMissione` — non riallineare PMA da missione. */
export function pazienteEsclusoDaSyncMissioneAdmin(paziente) {
  if (!paziente) return true;
  if (String(paziente.statoPzPma ?? '').trim().toUpperCase() === 'DIMESSO') return true;
  return false;
}

export { pazienteCollegatoAMissione, seedFromPazienteEvento, EMPTY_PMA_SCHEDA };
export { pazienteMatchesMissioneTrasporto } from './pazienteMissionMatch.js';
