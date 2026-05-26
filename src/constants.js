export const IS_SUPERADMIN = import.meta.env.VITE_SUPERADMIN === 'true';

/**
 * ID documento sotto `manifestazioni/{id}` (opzionale).
 * Se assente: si usa l'unico documento in Firestore, oppure il primo se ce ne sono più di uno.
 */
export const TENANT_ID = (import.meta.env.VITE_TENANT_ID ?? '').trim();

export const GOOGLE_MAPS_API_KEY = (
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? ''
).trim();

import { DEFAULT_TIPI_MEZZO } from './lib/tipiMezzo';
import {
  DEFAULT_DETTAGLI_PER_TIPO_LUOGO,
  DEFAULT_TIPI_LUOGO,
} from './data/defaultLuoghiImpostazioni';

export const ESITO_TRASPORTA = 'Trasporta';
export const ESITO_ALTRO = 'Altro (specificare)';

/** Valori iniziali se non esiste ancora il documento impostazioni */
export const DEFAULT_IMPOSTAZIONI = {
  tipiEvento: ['Trauma', 'Malore', 'Intossicazione', 'Parto', 'Altro'],
  /** Dettaglio evento per ogni voce di tipiEvento (chiave = nome tipo) */
  dettagliPerTipoEvento: {},
  tipiLuogo: [...DEFAULT_TIPI_LUOGO],
  /** Dettaglio luogo per ogni voce di tipiLuogo (chiave = nome tipo luogo) */
  dettagliPerTipoLuogo: { ...DEFAULT_DETTAGLI_PER_TIPO_LUOGO },
  tipiMezzo: DEFAULT_TIPI_MEZZO,
  listaOspedali: [],
  stazionamenti: [],
  /** PMA: [{ id, nome, indirizzo, luogo_fisico, coordinate }] */
  pma: [],
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
  /** Piantina PNG per tabellone tattico (Storage → URL download). */
  piantina_url: null,
  /** Guida operativa PDF (Cloudinary raw → URL). */
  guida_pdf_url: null,
  /** Luogo fisico predefinito (struttura chiusa, settore, tribuna…). */
  luogo_fisico: '',
  /** Se true, webhook e invio missioni Telegram sono consentiti. */
  telegramBotEnabled: false,
  /** Se false, niente posizione reale da Telegram e mappa solo stazionamento. */
  telegramGpsTrackingEnabled: true,
  /** Incrementato a ogni cambio password bot; i client Telegram devono allinearsi. */
  telegramPasswordEpoch: 0,
  /** Liste cliniche e testi legali per modulo PMA interno. */
  pmaClinica: {
    prestazioni: [],
    farmaci: [],
    farmaci_consumati: [],
    dettaglio_eo_rapido: {},
    dettaglio_eo_rapido_default: '',
    preset_dimissione: [],
    preset_farmaci: [],
    consenso_generico_cure: '',
    consenso_privacy: '',
    rifiuto_invio_ps: '',
  },
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

/** Stato centrale per pazienti autopresentati al PMA (non usano il flusso missione/trasporto). */
export const STATO_PAZIENTE_PMA = 'PMA';
