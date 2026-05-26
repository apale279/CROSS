import { isDimissioneEsito } from '../types/dimissione';
import type { Paziente } from '../types/paziente';

/** Controlli obbligatori prima di «Dimetti paziente». */
export function validateDimissioneBeforeClose(p: Pick<
  Paziente,
  | 'dimissione_esito'
  | 'dimissione_note'
  | 'invio_ps_ospedale'
  | 'affidatario_nome'
  | 'affidatario_cognome'
  | 'firma_paziente_base64'
  | 'firma_paziente_url'
>): string[] {
  const errors: string[] = [];

  if (!isDimissioneEsito(p.dimissione_esito)) {
    errors.push('Seleziona l\'esito della dimissione.');
  }

  if (!String(p.dimissione_note ?? '').trim()) {
    errors.push('Inserisci le note di dimissione.');
  }

  if (p.dimissione_esito === 'invio_ps' && !String(p.invio_ps_ospedale ?? '').trim()) {
    errors.push('Indica l\'ospedale di destinazione per l\'invio in PS.');
  }

  if (p.dimissione_esito === 'riaffidato') {
    const nome = [p.affidatario_cognome, p.affidatario_nome].filter(Boolean).join(' ').trim();
    if (!nome) {
      errors.push('Indica nome e cognome dell\'affidatario.');
    }
  }

  const hasFirmaPaziente =
    Boolean(String(p.firma_paziente_base64 ?? '').trim()) ||
    Boolean(String(p.firma_paziente_url ?? '').trim());
  if (!hasFirmaPaziente) {
    errors.push('Registra la firma del paziente nella sezione dimissione.');
  }

  return errors;
}
