import { Timestamp } from 'firebase/firestore';
import { TIPO_PZ, STATO_PZ_PMA } from '../../lib/pmaModule';
import type { Paziente } from '@pma/types/paziente';
import { normalizePmaScheda, EMPTY_PMA_SCHEDA } from '@pma/lib/pmaSchedaDefaults';
import { parseParametriVitali, parseFarmaci, parseRivalutazioni } from '@pma/lib/parseCartellaClinica';

const PMA_SCHEDA_KEYS = new Set(Object.keys(EMPTY_PMA_SCHEDA));

const CENTRALE_PATCH_KEYS = new Set([
  'nome',
  'cognome',
  'pettorale',
  'telefono',
  'dataNascita',
  'eta',
  'sesso',
  'notePaziente',
  'email',
  'codice_fiscale',
]);

function mapStatoPma(statoPzPma, tipoPz, aperta) {
  if (statoPzPma === STATO_PZ_PMA.IN_ARRIVO) return 'in_arrivo';
  if (statoPzPma === STATO_PZ_PMA.IN_ATTESA) return 'in_attesa';
  if (statoPzPma === STATO_PZ_PMA.IN_CARICO) return 'in_carico';
  if (statoPzPma === STATO_PZ_PMA.DIMESSO) return 'dimesso';
  if (!aperta && tipoPz === TIPO_PZ.PMA) return 'dimesso';
  return 'in_attesa';
}

function tsOrNow(v) {
  if (v && typeof v.toMillis === 'function') return v;
  if (v && typeof v === 'string' && v.trim()) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return Timestamp.fromDate(d);
  }
  return Timestamp.now();
}

/** Documento CROSS → vista `Paziente` per cartella/dimissioni/PDF. */
export function crossDocToPazienteView(doc, manifestationId, pmaIdRoute) {
  const scheda = normalizePmaScheda(doc.pmaScheda);
  const pmaId = String(doc.pmaId || doc.destinazionePmaId || pmaIdRoute || '').trim();
  const tipoPz = doc.tipoPz === TIPO_PZ.PMA ? TIPO_PZ.PMA : TIPO_PZ.CENTRALE;

  const inCaricoPma = doc.statoPzPma === STATO_PZ_PMA.IN_CARICO;
  const dimessoPma = doc.statoPzPma === STATO_PZ_PMA.DIMESSO;

  const view: Paziente = {
    id: doc._docId ?? doc.id ?? '',
    id_manifestazione: manifestationId ?? '',
    id_pma: pmaId,
    /** Badge UI: scheda clinicamente modificabile (non coincide con `aperta` centrale). */
    scheda_pma_modificabile: canEditPmaScheda(null, doc),
    aperto: dimessoPma ? false : doc.aperta !== false,
    id_paziente_visibile: doc.idPaziente ?? '',
    apertura_scheda: tsOrNow(doc.apertura),
    tipo_paziente: tipoPz === TIPO_PZ.PMA ? 'autopresentato' : 'trasportato',
    breve_descrizione: scheda.breve_descrizione ?? '',
    codice_colore: scheda.codice_colore ?? 'verde',
    stato: mapStatoPma(doc.statoPzPma, tipoPz, doc.aperta),
    pettorale: doc.pettorale ?? null,
    nome: doc.nome ?? '',
    cognome: doc.cognome ?? '',
    data_nascita: doc.dataNascita ? tsOrNow(doc.dataNascita) : null,
    eta: doc.eta ?? null,
    email: doc.email ?? '',
    telefono: doc.telefono ?? '',
    email_tel: [doc.email, doc.telefono].filter(Boolean).join(' · '),
    codice_fiscale: doc.codice_fiscale ?? doc.codiceFiscale ?? '',
    note_centrale: doc.notePaziente ?? '',
    trasportato_da: doc.mezzo ?? null,
    ...scheda,
    parametri_vitali: parseParametriVitali(scheda.parametri_vitali),
    farmaci: parseFarmaci(scheda.farmaci),
    rivalutazioni: parseRivalutazioni(scheda.rivalutazioni),
    lesioni: Array.isArray(scheda.lesioni) ? scheda.lesioni : [],
    external_source: tipoPz === TIPO_PZ.CENTRALE ? 'CROSS' : null,
    cross_dati_scheda: buildCrossDatiScheda(doc),
  };

  return view;
}

function buildCrossDatiScheda(doc) {
  const lines = [];
  if (doc.eventoCorrelato) lines.push(`Evento: ${doc.eventoCorrelato}`);
  if (doc.mezzo) lines.push(`Mezzo: ${doc.mezzo}`);
  if (doc.stato) lines.push(`Stato centrale: ${doc.stato}`);
  if (doc.ospedaleDestinazione) lines.push(`Destinazione: ${doc.ospedaleDestinazione}`);
  return lines.length ? lines.join('\n') : null;
}

/**
 * Espande eventuale `pmaScheda` intero in chiavi singole (vietato sovrascrivere l'oggetto nested).
 */
export function normalizePazientePatchInput(patch) {
  const p = { ...(patch ?? {}) };
  const nested = p.pmaScheda;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    delete p.pmaScheda;
    Object.assign(p, nested);
  }
  return p;
}

/** Patch UI → update Firestore CROSS (campi top-level + `pmaScheda`). */
export function splitPazientePatch(patch) {
  const top = {};
  const scheda = {};
  for (const [k, v] of Object.entries(normalizePazientePatchInput(patch))) {
    if (k === 'aperto') {
      top.aperta = v;
    } else if (k === 'schedaModificaForzata') {
      top.schedaModificaForzata = v;
    } else if (k === 'statoPzPma' || k === 'stato_pz_pma') {
      top.statoPzPma = v;
    } else if (CENTRALE_PATCH_KEYS.has(k)) {
      if (k === 'data_nascita') top.dataNascita = v;
      else if (k === 'note_centrale') top.notePaziente = v;
      else top[k] = v;
    } else if (k === 'stato' && v === 'dimesso') {
      scheda.dimesso_at = patch.dimesso_at ?? scheda.dimesso_at;
      top.statoPzPma = STATO_PZ_PMA.DIMESSO;
      top.aperta = false;
    } else if (PMA_SCHEDA_KEYS.has(k) || k.startsWith('EO_') || k.startsWith('invio_ps_') || k.startsWith('dimissione_') || k.startsWith('affidatario_') || k.startsWith('firma_')) {
      scheda[k] = v;
    } else if (k === 'codice_colore' || k === 'breve_descrizione' || k === 'tipo_evento' || k === 'dettaglio_evento') {
      scheda[k] = v;
    }
  }
  const out = {};
  if (Object.keys(top).length) Object.assign(out, top);
  if (Object.keys(scheda).length) out.pmaScheda = scheda;
  return out;
}

/** Modifica scheda PMA: in carico in tenda, oppure dopo sblocco esplicito in scheda. */
export function canEditPmaScheda(
  _pazienteView: Paziente | null,
  rawDoc?: { statoPzPma?: string | null; schedaModificaForzata?: boolean },
) {
  if (rawDoc?.schedaModificaForzata === true) return true;
  if (rawDoc?.statoPzPma === STATO_PZ_PMA.IN_CARICO) return true;
  return false;
}

export function isPmaSchedaReadonly(
  rawDoc?: { statoPzPma?: string | null; schedaModificaForzata?: boolean },
) {
  return !canEditPmaScheda(null, rawDoc);
}

export function canEditPmaAnagrafica(doc) {
  return doc.tipoPz === TIPO_PZ.PMA;
}
