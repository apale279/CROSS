export type { UserRank } from '../lib/rankMatrix';

/** Profilo minimo per componenti scheda PMA portati da PMApp. */
export type UserProfile = {
  uid?: string;
  nome?: string;
  nomeUtente?: string;
  rank?: string;
  /** PNG data URL salvato alla acquisizione firma. */
  firma_medico_base64?: string | null;
  /** Firma medico in SVG (data URL o markup). */
  firma_medico_svg?: string | null;
  firmaUrl?: string | null;
};
