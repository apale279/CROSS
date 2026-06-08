import { DEFAULT_IMPOSTAZIONI } from '../constants';
import { isPazienteOriginePma, normalizeStatoPzPma, STATO_PZ_PMA } from './pmaModule';
import { MISSIONE_STATO_DIRETTO_H } from './pmaArrivoAlert';

export const MISSIONE_STATO_ARRIVATO_H = 'ARRIVATO H';

/** Motivo e dettaglio per card dashboard PMA. */
export function motivoDettaglioPazientePma(paziente, evento = null) {
  const tipo =
    String(paziente?.pmaScheda?.tipo_evento ?? '').trim() ||
    String(evento?.tipoEvento ?? '').trim();
  const dettaglio =
    String(paziente?.pmaScheda?.dettaglio_evento ?? '').trim() ||
    String(evento?.dettaglioEvento ?? '').trim();
  return { tipo, dettaglio };
}

export function anagraficaRighePazientePma(paziente) {
  const cognome = String(paziente?.cognome ?? '').trim();
  const nome = String(paziente?.nome ?? '').trim();
  return { cognome, nome };
}

/** Pettorale mostrato per centrale e autopresentato se valorizzato. */
export function mostraPettoralePazientePma(paziente) {
  if (paziente?.pettorale == null || String(paziente.pettorale).trim() === '') return false;
  return true;
}

/** Card in arrivo / in attesa: pettorale sulla riga del nome (no badge «PETT»). */
export function pettoraleInlineSuRigaNomePma(paziente) {
  if (!paziente) return false;
  const stato = normalizeStatoPzPma(paziente.statoPzPma);
  if (stato === STATO_PZ_PMA.IN_ATTESA || stato === STATO_PZ_PMA.IN_ARRIVO) return true;
  if (stato == null && !isPazienteOriginePma(paziente)) return true;
  return false;
}

export function isPazienteAutopresentatoPma(paziente) {
  return isPazienteOriginePma(paziente);
}

/** Missione collegata al paziente (uid preferito, altrimenti idMissione). */
export function findMissioneForPazientePma(missioni, paziente) {
  if (!paziente || !Array.isArray(missioni) || missioni.length === 0) return null;
  const uid = String(paziente.missioneIdUnivoco ?? '').trim();
  if (uid) {
    const byUid = missioni.find(
      (m) => String(m.idUnivoco ?? m._docId ?? '').trim() === uid,
    );
    if (byUid) return byUid;
  }
  const idM = String(paziente.idMissione ?? '').trim();
  if (!idM) return null;
  return missioni.find((m) => String(m.idMissione ?? '').trim() === idM) ?? null;
}

/** Centrale ancora in colonna «In arrivo» (non ancora in attesa / in carico). */
export function pazienteCentraleInArrivoAlDesk(paziente) {
  if (!paziente || isPazienteOriginePma(paziente)) return false;
  const stato = normalizeStatoPzPma(paziente.statoPzPma);
  return stato === STATO_PZ_PMA.IN_ARRIVO || stato == null;
}

/** Missione con mezzo già arrivato in ospedale/PMA (ARRIVATO H o stato successivo). */
export function missioneStatoArrivatoOPsuccessivo(
  statoMissione,
  statiLista = DEFAULT_IMPOSTAZIONI.statiMissione,
) {
  const ms = String(statoMissione ?? '').trim();
  if (!ms) return false;
  const seq = (statiLista ?? []).filter((s) => s !== 'ANNULLATA');
  const idxArrivato = seq.indexOf(MISSIONE_STATO_ARRIVATO_H);
  if (idxArrivato < 0) {
    return ms === MISSIONE_STATO_ARRIVATO_H || ms === 'RIENTRO' || ms === 'FINE MISSIONE';
  }
  const idx = seq.indexOf(ms);
  return idx >= idxArrivato && idx >= 0;
}

/** Freccia ➡️: centrale in arrivo al desk, mezzo ancora in DIRETTO H. */
export function mostraFrecciaDirettoHPma(paziente, missione) {
  if (!pazienteCentraleInArrivoAlDesk(paziente)) return false;
  if (!missione) return false;
  return String(missione.stato ?? '').trim() === MISSIONE_STATO_DIRETTO_H;
}

/** Emoji 🏥: centrale in arrivo al desk, mezzo già ARRIVATO H (o oltre). */
export function mostraEmojiArrivatoPma(paziente, missione) {
  if (!pazienteCentraleInArrivoAlDesk(paziente)) return false;
  if (!missione) return false;
  return missioneStatoArrivatoOPsuccessivo(missione.stato);
}
