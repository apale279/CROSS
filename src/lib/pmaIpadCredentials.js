/** Password kiosk iPad condivisa (semplice, come da specifica). */
export const PMA_IPAD_DEFAULT_PASSWORD = 'ipad123';

/** Slug da nome PMA per login tipo `nomepma_ipad`. */
export function slugifyPmaNome(nome) {
  return (
    String(nome ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '')
      .slice(0, 28) || 'pma'
  );
}

/**
 * Credenziali iPad standard per un PMA.
 * @param {{ nome?: string; ipadUser?: string; ipadPassword?: string; ipadEmail?: string }} pma
 */
export function pmaIpadCredentialsFromEntry(pma) {
  const slug = slugifyPmaNome(pma?.nome);
  const ipadUser = String(pma?.ipadUser ?? '').trim() || `${slug}_ipad`;
  const ipadPassword =
    String(pma?.ipadPassword ?? '').trim() || PMA_IPAD_DEFAULT_PASSWORD;
  const ipadEmail =
    String(pma?.ipadEmail ?? '').trim().toLowerCase() ||
    `${ipadUser}@cross.local`;
  return { ipadUser, ipadPassword, ipadEmail };
}

/** Aggiunge campi iPad al record PMA in impostazioni (se mancanti). */
export function enrichPmaEntryWithIpadCredentials(pmaEntry) {
  const creds = pmaIpadCredentialsFromEntry(pmaEntry);
  return {
    ...pmaEntry,
    ipadUser: creds.ipadUser,
    ipadPassword: creds.ipadPassword,
    ipadEmail: creds.ipadEmail,
  };
}
