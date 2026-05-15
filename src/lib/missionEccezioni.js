/** Motivi salvati su documento missione (`missioneEccezioneMotivo`). */
export const MISSIONE_ECCEZIONE_MOTIVO = {
  DIROTTAMENTO: 'DIROTTAMENTO',
  FLAG_DOWN: 'FLAG_DOWN',
  AVARIA_SINISTRO: 'AVARIA_SINISTRO',
};

/** Stato mezzo dopo avaria/sinistro in avvicinamento. */
export const MEZZO_STATO_AVARIA_SINISTRO = 'Non operativo (avaria/sinistro)';

/** Tipo chiusura evento (es. stand-down richiesta annullata). */
export const EVENTO_TIPO_CHIUSURA = {
  OPERATORE: 'OPERATORE',
  STAND_DOWN: 'STAND_DOWN',
};

/** Origine creazione evento (es. intercettazione a vista). */
export const EVENTO_ORIGINE_ECCEZIONE = {
  FLAG_DOWN: 'FLAG_DOWN',
};
