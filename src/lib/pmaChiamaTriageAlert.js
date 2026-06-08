import { normalizeStatoPzPma, pmaIdPerPaziente, STATO_PZ_PMA } from './pmaModule';
import { pazienteInArrivoLabel } from './pmaArrivoAlert';

/** Sequenza alert «Chiama triage» (incrementa a ogni pressione del pulsante). */
export function pmaChiamaTriageSeq(paziente) {
  return Number(paziente?.pmaChiamaTriageSeq ?? 0);
}

/** Ultima sequenza chiusa da un operatore triage. */
export function pmaChiamaTriageChiusoSeq(paziente) {
  return Number(paziente?.pmaChiamaTriageChiusoSeq ?? 0);
}

export function isPazienteChiamaTriageAlertAttivo(paziente) {
  const seq = pmaChiamaTriageSeq(paziente);
  const chiuso = pmaChiamaTriageChiusoSeq(paziente);
  return seq > 0 && seq > chiuso;
}

export function pmaChiamaTriageAlertKey(docId, seq) {
  return `chiama_triage:${docId}:${seq}`;
}

export function titoloAlertPmaChiamaTriage() {
  return 'Chiamata paziente';
}

export function pazienteChiamaTriageLabel(paziente) {
  return pazienteInArrivoLabel(paziente);
}

/** Alert «Chiama» ancora aperti per un PMA, dal più recente. */
export function collectPmaChiamaTriageAlertsAttivi(docs, pmaId) {
  const pid = String(pmaId ?? '').trim();
  if (!pid) return [];

  return (docs ?? [])
    .map((d) => ({ _docId: d.id, ...d.data() }))
    .filter((p) => {
      if (!isPazienteChiamaTriageAlertAttivo(p)) return false;
      if (normalizeStatoPzPma(p.statoPzPma) !== STATO_PZ_PMA.IN_ATTESA) return false;
      return pmaIdPerPaziente(p) === pid;
    })
    .sort((a, b) => {
      const ta = a.pmaChiamaTriageInviatoIl?.toMillis?.() ?? 0;
      const tb = b.pmaChiamaTriageInviatoIl?.toMillis?.() ?? 0;
      return tb - ta;
    })
    .map((paziente) => ({
      alertKey: pmaChiamaTriageAlertKey(paziente._docId, pmaChiamaTriageSeq(paziente)),
      pazienteDocId: paziente._docId,
      pmaId: pid,
      paziente,
      seq: pmaChiamaTriageSeq(paziente),
      inviatoDa: paziente.pmaChiamaTriageInviatoDa ?? null,
    }));
}
