import { isPazienteOriginePma } from './pmaModule';
import { MISSIONE_STATO_DIRETTO_H } from './pmaArrivoAlert';

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

/** Freccia «in arrivo» solo pazienti centrale con mezzo in DIRETTO H. */
export function mostraFrecciaDirettoHPma(paziente, missione) {
  if (!paziente || isPazienteOriginePma(paziente)) return false;
  if (!missione) return false;
  return String(missione.stato ?? '').trim() === MISSIONE_STATO_DIRETTO_H;
}
