import { Timestamp } from 'firebase/firestore';
import { applyMissioneArrivatoH } from '../lib/pazienteRules';
import { STATO_PZ_PMA, TIPO_PZ } from '../lib/pmaModule';
import {
  fetchPazientiTrasportoOnMezzo,
  pazienteSameEventoAsMissione,
} from '../lib/pazientiTrasportoQuery';
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

/** Mezzo in DIRETTO H → pazienti verso quel PMA in «IN ARRIVO» (vista PMA). */
export async function syncPazientiPmaOnDirettoH(manifestationId, missione) {
  if (!missione?.mezzo) return { updated: 0 };
  const candidati = await fetchPazientiTrasportoOnMezzo(manifestationId, missione.mezzo);
  const tasks = [];

  for (const p of candidati) {
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

/** Estensione sync ARRIVATO H: chiusura missione centrale + «in carico» PMA se destinazione tenda. */
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
