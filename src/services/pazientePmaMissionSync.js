import { Timestamp } from 'firebase/firestore';
import { applyMissioneArrivatoH } from '../lib/pazienteRules';
import { normalizeStatoPzPma, STATO_PZ_PMA, TIPO_PZ } from '../lib/pmaModule';
import {
  fetchPazientiTrasportoOnMezzo,
  pazienteSameEventoAsMissione,
} from '../lib/pazientiTrasportoQuery';
import { pazienteEsclusoDaSyncMissione } from '../lib/pmaInvioPsMission';
import { patchPaziente } from './pazientiService';
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

/** Dopo cambio destinazione verso PMA: inizializza `pmaScheda` se assente. */
export async function ensurePmaSchedaOnDestinazione(manifestationId, docId, paziente, evento = null) {
  if (!manifestationId || !docId) return;
  if (!String(paziente?.destinazionePmaId ?? '').trim()) return;
  if (paziente.pmaScheda) return;
  const seed = seedFromPazienteEvento(paziente, evento);
  await initPmaSchedaIfMissing(manifestationId, docId, Object.keys(seed).length ? seed : null);
}

function pazienteCollegatoAMissione(p, missione) {
  return (
    pazienteSameEventoAsMissione(p, missione) &&
    String(p.destinazionePmaId ?? '').trim()
  );
}

const STATI_MISSIONE_PMA_SYNC = new Set(['DIRETTO H', 'ARRIVATO H', 'RIENTRO']);

/**
 * Destinazione PMA impostata/tardiva mentre la missione è già in viaggio o conclusa:
 * allinea statoPzPma (IN ARRIVO o in carico se ARRIVATO H).
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
  if (!pazienteSameEventoAsMissione(paziente, missione)) return;

  const ms = String(missione.stato ?? '');
  if (!STATI_MISSIONE_PMA_SYNC.has(ms)) return;

  const cur = normalizeStatoPzPma(paziente.statoPzPma);
  if (cur === STATO_PZ_PMA.DIMESSO) return;

  if (ms === 'ARRIVATO H') {
    if (paziente.stato === 'ARRIVATO H' && cur === STATO_PZ_PMA.IN_CARICO) return;
    const result = patchPazienteArrivatoHConPma(paziente, evento);
    if (!result?.patch) return;
    await patchPaziente(manifestationId, paziente._docId, result.patch);
    if (result.initPmaScheda) {
      await initPmaSchedaIfMissing(manifestationId, paziente._docId, result.pmaSchedaSeed);
    }
    if (result.markIngressoCarico) {
      await patchPazientePmaGranular(manifestationId, paziente._docId, {
        ingresso_carico_at: Timestamp.now(),
      });
    }
    return;
  }

  if (cur === STATO_PZ_PMA.IN_CARICO || cur === STATO_PZ_PMA.IN_ARRIVO) return;

  await patchPaziente(manifestationId, paziente._docId, {
    tipoPz: paziente.tipoPz ?? TIPO_PZ.CENTRALE,
    pmaId: paziente.pmaId ?? paziente.destinazionePmaId,
    statoPzPma: STATO_PZ_PMA.IN_ARRIVO,
  });
  if (!paziente.pmaScheda) {
    await ensurePmaSchedaOnDestinazione(manifestationId, paziente._docId, paziente, evento);
  }
}

/** Mezzo in DIRETTO H → pazienti verso quel PMA in «IN ARRIVO» (vista PMA). */
export async function syncPazientiPmaOnDirettoH(manifestationId, missione) {
  if (!missione?.mezzo) return { updated: 0 };
  const candidati = await fetchPazientiTrasportoOnMezzo(manifestationId, missione.mezzo);
  const tasks = [];

  for (const p of candidati) {
    if (pazienteEsclusoDaSyncMissione(p)) continue;
    if (!pazienteCollegatoAMissione(p, missione)) continue;
    tasks.push(
      patchPaziente(manifestationId, p._docId, {
        tipoPz: p.tipoPz ?? TIPO_PZ.CENTRALE,
        pmaId: p.pmaId ?? p.destinazionePmaId ?? '',
        statoPzPma: STATO_PZ_PMA.IN_ARRIVO,
      }),
    );
    if (!p.pmaScheda) {
      tasks.push(ensurePmaSchedaOnDestinazione(manifestationId, p._docId, p, null));
    }
  }

  await Promise.all(tasks);
  return { updated: tasks.length };
}

/** ARRIVATO H + destinazione PMA: chiusura centrale e «in carico» in tenda. */
export function patchPazienteArrivatoHConPma(paziente, evento = null) {
  const patch = applyMissioneArrivatoH(paziente);
  if (!patch) return null;
  let initPmaScheda = false;
  let pmaSchedaSeed = null;
  let markIngressoCarico = false;
  if (String(paziente.destinazionePmaId ?? '').trim()) {
    patch.statoPzPma = STATO_PZ_PMA.IN_CARICO;
    patch.pmaId = paziente.pmaId ?? paziente.destinazionePmaId ?? '';
    if (!paziente.pmaScheda) {
      initPmaScheda = true;
      pmaSchedaSeed = {
        ingresso_carico_at: Timestamp.now(),
        ...seedFromPazienteEvento(paziente, evento),
      };
    } else {
      markIngressoCarico = true;
    }
  }
  return { patch, initPmaScheda, pmaSchedaSeed, markIngressoCarico };
}
