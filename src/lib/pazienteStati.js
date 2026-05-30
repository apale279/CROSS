/**
 * Due livelli di stato sul documento paziente Firestore:
 *
 * 1) CENTRALE (missione / trasporto)
 *    - `stato`: ATTESA | TRASPORTO | ARRIVATO H  (autopresentato: `PMA` = non usa trasporto)
 *    - `aperta`: se false → chiuso in elenco centrale (tipicamente dopo ARRIVATO H)
 *
 * 2) PMA (tenda, solo se destinazione PMA o tipoPz PMA)
 *    - `statoPzPma`: IN ARRIVO | IN ATTESA | in carico | DIMESSO
 *
 * Un paziente inviato al PMA dalla centrale, dopo ARRIVATO H, è:
 *    - chiuso per la centrale (`aperta: false`, `stato: ARRIVATO H`)
 *    - in tenda `IN ARRIVO` fino a «Prendi in carico», poi `in carico` fino a dimissione PMA
 */

import {
  isPazienteOriginePma,
  isPazienteCodiceMinore,
  pazienteHaDestinazionePma,
  pazienteHaSchedaPma,
  pazientePmaChiuso,
  pazientePmaAperto,
  statoPzPmaLabel,
} from './pmaModule';

/** Chiuso lato centrale (missione/trasporto concluso o flag esplicito). */
export function isChiusoCentrale(paziente) {
  if (!paziente) return false;
  if (isPazienteOriginePma(paziente)) return false;
  if (paziente.aperta === false) return true;
  return paziente.stato === 'ARRIVATO H';
}

/** Ha ancora un percorso PMA attivo (non dimesso). */
export function isAttivoPma(paziente) {
  if (!pazienteHaSchedaPma(paziente)) return false;
  return pazientePmaAperto(paziente);
}

/**
 * Elenco centrale «Chiusi»: missione/trasporto concluso e, se inviato al PMA, anche dimesso in tenda.
 * Un centrale ARRIVATO H ma ancora IN ARRIVO / in carico al PMA resta in «Aperti».
 */
export function pazienteInElencoChiusi(paziente) {
  if (!paziente) return false;
  if (isPazienteCodiceMinore(paziente) || isPazienteOriginePma(paziente)) {
    return pazientePmaChiuso(paziente);
  }
  if (!isChiusoCentrale(paziente)) return false;
  if (!pazienteHaDestinazionePma(paziente)) return true;
  return pazientePmaChiuso(paziente);
}

/** Elenco centrale «Aperti» (complemento di {@link pazienteInElencoChiusi}). */
export function pazienteInElencoAperti(paziente) {
  return Boolean(paziente) && !pazienteInElencoChiusi(paziente);
}

/** Esito/mezzo/destinazione centrale modificabili fino a chiusura missione (ARRIVATO H). */
export function isTrasportoCentraleModificabile(paziente) {
  if (!paziente) return true;
  if (isPazienteOriginePma(paziente)) return false;
  if (paziente.stato === 'ARRIVATO H') return false;
  if (paziente.aperta === false) return false;
  return true;
}

/** Etichetta stato trasporto/missione (campo `stato`). */
export function statoCentraleLabel(paziente) {
  if (!paziente) return '—';
  if (isPazienteOriginePma(paziente)) {
    return 'Autopresentato (nessun trasporto centrale)';
  }
  return paziente.stato ?? '—';
}

/** Etichetta sintetica chiusura centrale per UI. */
export function chiusuraCentraleLabel(paziente) {
  if (!paziente || isPazienteOriginePma(paziente)) return null;
  if (!isChiusoCentrale(paziente)) return null;
  if (paziente.stato === 'ARRIVATO H') return 'Chiuso centrale (ARRIVATO H)';
  if (paziente.aperta === false) return 'Chiuso centrale';
  return null;
}

/** Colonna «Stato» in elenco pazienti: centrale e, se PMA, anche stato tenda. */
export function displayStatoPazienteInLista(paziente) {
  if (isPazienteCodiceMinore(paziente)) {
    return statoPzPmaLabel(paziente.statoPzPma) ?? 'Codice minore';
  }
  if (isPazienteOriginePma(paziente)) {
    return statoPzPmaLabel(paziente.statoPzPma) ?? '—';
  }

  const centrale = statoCentraleLabel(paziente);
  if (!pazienteHaDestinazionePma(paziente)) {
    return centrale;
  }

  const pma = statoPzPmaLabel(paziente.statoPzPma);
  if (!pma) {
    return `${centrale} · PMA: in attesa mezzo`;
  }
  return `${centrale} · PMA: ${pma}`;
}

/**
 * Timestamp chiusura effettiva in elenco: dimissione PMA se dimesso in tenda,
 * altrimenti ARRIVATO H centrale. Null se il paziente è ancora aperto in elenco.
 */
export function pazienteChiusuraAt(paziente) {
  if (!paziente || pazienteInElencoAperti(paziente)) return null;
  if (pazientePmaChiuso(paziente)) {
    return paziente.pmaScheda?.dimesso_at ?? null;
  }
  return paziente.arrivatoHAt ?? null;
}
