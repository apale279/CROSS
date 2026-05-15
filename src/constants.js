export const IS_SUPERADMIN = import.meta.env.VITE_SUPERADMIN === 'true';

/**
 * ID documento opzionale: se assente e in Firestore c'è un solo documento in
 * `manifestazioni`, viene usato automaticamente (vedi TenantContext).
 * Con più documenti, impostare esplicitamente questa variabile.
 */
export const TENANT_ID = (import.meta.env.VITE_TENANT_ID ?? '').trim();

export const GOOGLE_MAPS_API_KEY = (
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? ''
).trim();

export const ESITO_TRASPORTA = 'Trasporta';
export const ESITO_ALTRO = 'Altro (specificare)';

/** Valori iniziali se non esiste ancora il documento impostazioni */
export const DEFAULT_IMPOSTAZIONI = {
  tipiEvento: ['Trauma', 'Malore', 'Intossicazione', 'Parto', 'Altro'],
  /** Dettaglio evento per ogni voce di tipiEvento (chiave = nome tipo) */
  dettagliPerTipoEvento: {},
  tipiMezzo: ['Ambulanza', 'Auto medica', 'Moto medica', 'Unità mobile'],
  listaOspedali: [],
  stazionamenti: [],
  /** Corridori da Excel: [{ pettorale, nome, cognome, dataNascita, telefono }] */
  registryPartecipanti: [],
  coloriEvento: ['Bianco', 'Verde', 'Giallo', 'Rosso'],
  statiMissione: [
    'ALLERTARE',
    'ALLERTATO',
    'PARTITO',
    'IN POSTO',
    'DIRETTO H',
    'ARRIVATO H',
    'RIENTRO',
    'FINE MISSIONE',
    /** Missione interrotta (dirottamento, flag-down, ecc.): non conta come chiusura “normale” dell’evento. */
    'ANNULLATA',
  ],
  /**
   * Centro iniziale mappa dashboard quando nessun evento ha coordinate.
   * `{ luogo, lat, lng, zoom? }` oppure null = default geografico Roma.
   */
  mappaDashboardDefault: null,
};

export const ESITI_PAZIENTE = [
  ESITO_TRASPORTA,
  'Non trasporta',
  'Rifiuto trasporto',
  'Risolto in posto',
  'Si allontana',
  ESITO_ALTRO,
];

export const STATI_PAZIENTE = ['ATTESA', 'TRASPORTO', 'ARRIVATO H'];
