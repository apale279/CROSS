import {
  isPazienteOriginePma,
  normalizeStatoPzPma,
  pazienteHaDestinazionePma,
  pazienteHaSchedaPma,
  STATO_PZ_PMA,
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

/** Scheda unificata PMA in centrale solo quando il flusso PMA è partito (sync mezzo). */
export function usaSchedaUnificataPma(paziente) {
  if (!paziente) return false;
  if (!pmaIdDaPaziente(paziente)) return false;
  const stato = normalizeStatoPzPma(paziente.statoPzPma);
  return stato != null && stato !== STATO_PZ_PMA.DIMESSO;
}
