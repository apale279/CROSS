import { labelPazientePmaRiga } from './missionPmaPatientClose';

/**
 * @returns {'keep' | 'cancel' | null} null = operatore ha annullato l'intera azione
 */
export function promptMissionPmaPatientsClose(pazientiTarget, { titolo, impostazioni } = {}) {
  if (!pazientiTarget?.length) return 'keep';

  const righe = pazientiTarget.map((p) => labelPazientePmaRiga(p, impostazioni)).join('\n');
  const head =
    titolo ??
    `Ci sono ${pazientiTarget.length} paziente/i inviati verso PMA:\n\n${righe}\n\nCome procedere?`;

  const mantieni = window.confirm(
    `${head}\n\n` +
      'OK = Mantieni in arrivo al PMA\n' +
      '(scollegati da evento, missione e mezzo; resta solo una traccia testuale)\n\n' +
      'Annulla = Vai alla scelta successiva…',
  );

  if (mantieni) return 'keep';

  const annullaInvio = window.confirm(
    `${head}\n\n` +
      'Annullare l\'invio PMA?\n\n' +
      'OK = Rimuovi dalla tenda (paziente resta sull\'evento, senza trasporto)\n' +
      'Annulla = Interrompi: nessuna modifica a missione/evento',
  );

  if (!annullaInvio) return null;
  return 'cancel';
}
