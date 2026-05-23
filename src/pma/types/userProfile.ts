/** Profilo minimo per componenti scheda PMA portati da PMApp. */
export type UserProfile = {
  uid?: string;
  nome?: string;
  nomeUtente?: string;
  rank?: string;
  firma_medico_base64?: string | null;
  firmaUrl?: string | null;
};
