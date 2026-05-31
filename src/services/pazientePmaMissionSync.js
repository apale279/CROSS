import { Timestamp, deleteField, doc, runTransaction } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { applyMissioneArrivatoH } from '../lib/pazienteRules';
import { pazientiPath } from '../lib/firestorePaths';
import {
  buildCodiceMinoreTrasportoNome,
  shouldAutoNomeCodiceMinoreTrasporto,
} from '../lib/codiceMinoreTrasportoNome';
import { isPercorsoCodiceMinoreTrasporto } from '../lib/pmaDestinazioneTrasporto';
import { normalizeStatoPzPma, STATO_PZ_PMA, TIPO_PZ } from '../lib/pmaModule';
import {
  fetchPazientiTrasportoForMissione,
  pazienteSuMissione,
} from '../lib/pazientiTrasportoQuery';
import { pazienteEsclusoDaSyncMissione } from '../lib/pmaInvioPsMission';
import {
  detectPmaCodiceColoreConflict,
  pmaCodiceColoreSyncBlocked,
} from '../lib/pazienteSyncGuard';
import {
  patchPaziente,
  transitionPazienteArrivatoHTransaction,
  transitionPazientePmaInArrivoIfAllowed,
} from './pazientiService';
import { initPmaSchedaIfMissing, patchPazientePmaGranular } from '../pma/lib/pazientePmaPatch';

/** MSB/MSA (Bianco…) → triage PMA (`pmaScheda.codice_colore`). */
export function coloreSanitarioToPmaCodice(codice) {
  const m = {
    Bianco: 'bianco',
    Verde: 'verde',
    Giallo: 'giallo',
    Rosso: 'rosso',
  };
  return m[String(codice ?? '').trim()] ?? null;
}

/** Triages PMA → codice sanitario dashboard (Bianco…). */
export function pmaCodiceToColoreSanitario(codice) {
  const m = {
    bianco: 'Bianco',
    verde: 'Verde',
    giallo: 'Giallo',
    rosso: 'Rosso',
  };
  return m[String(codice ?? '').trim().toLowerCase()] ?? null;
}

/** Allinea `pmaScheda.codice_colore` al codice sanitario scelto in centrale (solo se consentito). */
export async function syncPmaCodiceColoreFromSanitario(
  manifestationId,
  docId,
  paziente,
  codiceColore,
  { forceApply = false } = {},
) {
  if (!manifestationId || !docId || !paziente?.pmaScheda) {
    return { applied: false };
  }
  if (pmaCodiceColoreSyncBlocked(paziente)) {
    return { applied: false, reason: 'pma_active' };
  }
  const conflict = detectPmaCodiceColoreConflict(paziente, codiceColore);
  if (conflict && !forceApply) {
    return { applied: false, conflict };
  }
  const pmaCodice = coloreSanitarioToPmaCodice(codiceColore);
  if (!pmaCodice) return { applied: false };
  await patchPazientePmaGranular(manifestationId, docId, { codice_colore: pmaCodice });
  return { applied: true };
}

/** Seed iniziale `pmaScheda` da paziente centrale (P) e evento (tipo/dettaglio). */
export function seedFromPazienteEvento(paziente, evento) {
  const seed = {};
  if (evento) {
    seed.tipo_evento = String(evento.tipoEvento ?? '').trim();
    seed.dettaglio_evento = String(evento.dettaglioEvento ?? '').trim();
  }
  const fromP = coloreSanitarioToPmaCodice(paziente.codiceColoreSanitario);
  if (fromP) seed.codice_colore = fromP;
  return seed;
}

/** Dopo cambio destinazione verso PMA: inizializza `pmaScheda` se assente. */
export async function ensurePmaSchedaOnDestinazione(manifestationId, docId, paziente, evento = null) {
  if (!manifestationId || !docId) return;
  if (!String(paziente?.destinazionePmaId ?? '').trim()) return;
  if (isPercorsoCodiceMinoreTrasporto(paziente)) return;
  if (paziente.pmaScheda) return;
  const seed = seedFromPazienteEvento(paziente, evento);
  await initPmaSchedaIfMissing(manifestationId, docId, Object.keys(seed).length ? seed : null);
}

export function seedCodiceMinoreFromTrasporto(paziente, evento) {
  const parts = [];
  if (evento?.tipoEvento) parts.push(String(evento.tipoEvento).trim());
  if (evento?.dettaglioEvento) parts.push(String(evento.dettaglioEvento).trim());
  return {
    motivoArrivo: parts.filter(Boolean).join(' — ') || String(paziente?.notePaziente ?? '').trim(),
    trattamento: '',
    daTrasportoCentrale: true,
  };
}

/** Percorso astanteria da centrale: blocco `codiceMinore` senza cartella clinica. */
export async function ensureCodiceMinoreOnDestinazione(
  manifestationId,
  docId,
  paziente,
  evento = null,
) {
  if (!manifestationId || !docId) return;
  if (!String(paziente?.destinazionePmaId ?? '').trim()) return;
  if (!isPercorsoCodiceMinoreTrasporto(paziente)) return;

  const seed = seedCodiceMinoreFromTrasporto(paziente, evento);
  const docRef = doc(db, ...pazientiPath(manifestationId), docId);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(docRef);
    if (!snap.exists()) return;
    const data = snap.data();
    const cm = data.codiceMinore && typeof data.codiceMinore === 'object' ? data.codiceMinore : {};
    const updates = {
      tipoPz: TIPO_PZ.CODICE_MINORE,
      percorsoCodiceMinore: true,
      aperta: true,
    };
    if (!cm.motivoArrivo && seed.motivoArrivo) {
      updates['codiceMinore.motivoArrivo'] = seed.motivoArrivo;
    }
    if (cm.trattamento == null || cm.trattamento === '') {
      updates['codiceMinore.trattamento'] = seed.trattamento ?? '';
    }
    if (cm.oraFine == null && !Object.prototype.hasOwnProperty.call(cm, 'oraFine')) {
      updates['codiceMinore.oraFine'] = null;
    }
    if (cm.daTrasportoCentrale !== true) {
      updates['codiceMinore.daTrasportoCentrale'] = true;
    }
    if (shouldAutoNomeCodiceMinoreTrasporto(data)) {
      updates.nome = buildCodiceMinoreTrasportoNome({
        mezzo: data.mezzo,
        idPaziente: data.idPaziente,
      });
    }
    transaction.update(docRef, updates);
  });
}

/** Stato PMA da impostare solo se non già avanzato in tenda. */
export function statoPzPmaInArrivoIfAllowed(paziente) {
  const cur = normalizeStatoPzPma(paziente?.statoPzPma);
  if (
    cur === STATO_PZ_PMA.DIMESSO ||
    cur === STATO_PZ_PMA.IN_CARICO ||
    cur === STATO_PZ_PMA.IN_ATTESA
  ) {
    return null;
  }
  return STATO_PZ_PMA.IN_ARRIVO;
}

/**
 * Centrale invia verso PMA: stato tenda «IN ARRIVO» (presa in carico solo da desk PMA).
 * Non sovrascrive «in carico» o «DIMESSO».
 */
export async function setPazientePmaInArrivo(manifestationId, docId, paziente, evento = null) {
  if (!manifestationId || !docId) return;
  if (!String(paziente?.destinazionePmaId ?? '').trim()) return;
  const cur = normalizeStatoPzPma(paziente.statoPzPma);
  if (
    cur === STATO_PZ_PMA.DIMESSO ||
    cur === STATO_PZ_PMA.IN_CARICO ||
    cur === STATO_PZ_PMA.IN_ATTESA
  ) {
    return;
  }

  const codiceMinorePath = isPercorsoCodiceMinoreTrasporto(paziente);
  const patch = {
    pmaId: paziente.pmaId ?? paziente.destinazionePmaId ?? '',
    statoPzPma: codiceMinorePath ? STATO_PZ_PMA.IN_ARRIVO : STATO_PZ_PMA.IN_ARRIVO,
    aperta: true,
  };

  if (codiceMinorePath) {
    patch.tipoPz = TIPO_PZ.CODICE_MINORE;
    patch.percorsoCodiceMinore = true;
  } else {
    patch.tipoPz = TIPO_PZ.CENTRALE;
    patch.percorsoCodiceMinore = deleteField();
  }

  await patchPaziente(manifestationId, docId, patch);

  if (codiceMinorePath) {
    await ensureCodiceMinoreOnDestinazione(
      manifestationId,
      docId,
      { ...paziente, ...patch, percorsoCodiceMinore: true, tipoPz: TIPO_PZ.CODICE_MINORE },
      evento,
    );
    return;
  }

  if (!paziente.pmaScheda) {
    await ensurePmaSchedaOnDestinazione(manifestationId, docId, paziente, evento);
  }
}

function pazienteCollegatoAMissione(p, missione) {
  return (
    pazienteSuMissione(p, missione) &&
    String(p.destinazionePmaId ?? '').trim()
  );
}

const STATI_MISSIONE_PMA_SYNC = new Set(['DIRETTO H', 'ARRIVATO H', 'RIENTRO']);

/**
 * Destinazione PMA impostata/tardiva mentre la missione è già in viaggio o conclusa:
 * allinea statoPzPma a IN ARRIVO (mai in carico automatico da stato mezzo).
 */
export async function syncPmaStatoOnDestinazionePaziente(
  manifestationId,
  paziente,
  missione,
  evento = null,
) {
  if (!manifestationId || !paziente?._docId) return;
  if (!String(paziente.destinazionePmaId ?? '').trim()) return;
  if (!missione || missione.aperta === false) return;
  if (!pazienteSuMissione(paziente, missione)) return;

  const ms = String(missione.stato ?? '');
  if (!STATI_MISSIONE_PMA_SYNC.has(ms)) return;

  const cur = normalizeStatoPzPma(paziente.statoPzPma);
  if (cur === STATO_PZ_PMA.DIMESSO) return;

  if (ms === 'ARRIVATO H') {
    await transitionPazienteArrivatoHTransaction(manifestationId, paziente._docId, evento);
    return;
  }

  if (cur === STATO_PZ_PMA.IN_CARICO || cur === STATO_PZ_PMA.IN_ARRIVO) return;

  await transitionPazientePmaInArrivoIfAllowed(manifestationId, paziente._docId);
  if (isPercorsoCodiceMinoreTrasporto(paziente)) {
    await ensureCodiceMinoreOnDestinazione(manifestationId, paziente._docId, paziente, evento);
    return;
  }
  if (!paziente.pmaScheda) {
    await ensurePmaSchedaOnDestinazione(manifestationId, paziente._docId, paziente, evento);
  }
}

/** Missione in DIRETTO H → pazienti verso PMA della stessa missione in «IN ARRIVO». */
export async function syncPazientiPmaOnDirettoH(manifestationId, missione) {
  if (!missione) return { updated: 0 };
  const candidati = await fetchPazientiTrasportoForMissione(manifestationId, missione);
  let updated = 0;

  for (const p of candidati) {
    if (pazienteEsclusoDaSyncMissione(p)) continue;
    if (!pazienteCollegatoAMissione(p, missione)) continue;
    const did = await transitionPazientePmaInArrivoIfAllowed(manifestationId, p._docId);
    if (did) updated += 1;
    if (isPercorsoCodiceMinoreTrasporto(p)) {
      await ensureCodiceMinoreOnDestinazione(manifestationId, p._docId, p, null);
      continue;
    }
    if (!p.pmaScheda) {
      await ensurePmaSchedaOnDestinazione(manifestationId, p._docId, p, null);
    }
  }

  return { updated };
}

/** ARRIVATO H + destinazione PMA: chiusura centrale; in tenda resta IN ARRIVO fino a presa in carico manuale. */
export function patchPazienteArrivatoHConPma(paziente, evento = null) {
  const patch = applyMissioneArrivatoH(paziente);
  if (!patch) return null;
  let initPmaScheda = false;
  let pmaSchedaSeed = null;
  if (String(paziente.destinazionePmaId ?? '').trim()) {
    patch.pmaId = paziente.pmaId ?? paziente.destinazionePmaId ?? '';
    if (isPercorsoCodiceMinoreTrasporto(paziente)) {
      patch.tipoPz = TIPO_PZ.CODICE_MINORE;
      patch.percorsoCodiceMinore = true;
      patch.statoPzPma = STATO_PZ_PMA.IN_CARICO;
      patch['codiceMinore.oraArrivo'] = Timestamp.now();
      return { patch, initPmaScheda: false, pmaSchedaSeed: null, markIngressoCarico: false };
    }
    const cur = normalizeStatoPzPma(paziente.statoPzPma);
    if (
      cur !== STATO_PZ_PMA.DIMESSO &&
      cur !== STATO_PZ_PMA.IN_CARICO &&
      cur !== STATO_PZ_PMA.IN_ATTESA
    ) {
      patch.statoPzPma = STATO_PZ_PMA.IN_ARRIVO;
    }
    if (!paziente.pmaScheda) {
      initPmaScheda = true;
      pmaSchedaSeed = seedFromPazienteEvento(paziente, evento);
    }
  }
  return { patch, initPmaScheda, pmaSchedaSeed, markIngressoCarico: false };
}
