import {
  isPazienteOriginePma,
  pazienteHaDestinazionePma,
  pazienteHaSchedaPma,
  TIPO_PZ,
} from './pmaModule';

/**
 * Vista scheda: chi apre il paziente (ordine tab e permessi UI).
 * Usare `vistaScheda` su `PazienteModuloPma`.
 */
export const VISTA_SCHEDA = {
  CENTRALE: 'centrale',
  PMA: 'pma',
};

export function isVistaCentrale(vista) {
  return vista === VISTA_SCHEDA.CENTRALE;
}

export function isVistaPma(vista) {
  return vista === VISTA_SCHEDA.PMA;
}

/** @deprecated Usare `vistaScheda` */
export const CONTESTO_SCHEDA = VISTA_SCHEDA;

/**
 * Origine paziente (Firestore `tipoPz`):
 * - CENTRALE: creato/gestito dalla centrale (può andare in ospedale o PMA).
 * - PMA: autopresentato alla tenda.
 */
export { TIPO_PZ } from './pmaModule';

/**
 * Quali blocchi compongono la scheda paziente.
 * @param {object} paziente documento Firestore (o draft con tipoPz, eventoCorrelato, …)
 */
/** Moduli scheda in creazione da evento (paziente centrale collegato all'evento aperto). */
export function moduliSchedaPazienteForCreate(evento) {
  return moduliSchedaPaziente({
    tipoPz: TIPO_PZ.CENTRALE,
    eventoCorrelato: evento?.idEvento ?? '',
    eventoIdUnivoco: evento?.idUnivoco ?? '',
  });
}

export function moduliSchedaPaziente(paziente) {
  const originePma = isPazienteOriginePma(paziente);
  const haPma = pazienteHaSchedaPma(paziente);
  const haEventoOperativo = Boolean(
    !originePma &&
      (String(paziente?.eventoCorrelato ?? '').trim() ||
        String(paziente?.eventoIdUnivoco ?? '').trim()),
  );

  return {
    anagrafica: true,
    eventoCentrale: haEventoOperativo,
    esitoTrasporto: !originePma,
    valutazioniSoccorso: !originePma,
    pmaStato: haPma,
    pmaEvento: haPma,
    pmaClinica: haPma,
    originePma,
    haPma,
    haEventoOperativo,
  };
}

export function pmaIdDaPaziente(paziente) {
  return String(paziente?.pmaId ?? paziente?.destinazionePmaId ?? '').trim();
}

/** Tab/modulo PMA in scheda centrale (anche paziente dimesso con storico PMA). */
export function mostraModuloPmaInSchedaCentrale(paziente) {
  if (!paziente) return false;
  if (!pmaIdDaPaziente(paziente)) return false;
  return pazienteHaSchedaPma(paziente);
}

/** @deprecated Usare `mostraModuloPmaInSchedaCentrale` */
export function usaSchedaUnificataPma(paziente) {
  return mostraModuloPmaInSchedaCentrale(paziente);
}
