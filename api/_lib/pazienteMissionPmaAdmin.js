import { FieldValue } from 'firebase-admin/firestore';

const ESITO_TRASPORTA = 'Trasporta';

const STATO_PZ_PMA = {
  IN_ARRIVO: 'IN ARRIVO',
  IN_CARICO: 'in carico',
};

const EMPTY_PMA_SCHEDA = {
  breve_descrizione: '',
  codice_colore: 'verde',
  apr: '',
  allergie: '',
  allergie_verifica: null,
  app: '',
  EO_GENERALE: [],
  EO_NEUROLOGICO: [],
  EO_CUTE: [],
  EO_TORACE: [],
  EO_ADDOME: [],
  EO_CAPO_COLLO: [],
  eo_note: '',
  parametri_vitali: [],
  prestazioni_sel: [],
  ecg_cloudinary_url: null,
  farmaci: [],
  rivalutazioni: [],
  lesioni: [],
  tipo_evento: '',
  dettaglio_evento: '',
  dimissione_esito: null,
  dimissione_note: '',
  affidatario_nome: '',
  affidatario_cognome: '',
  affidatario_legame: '',
  firma_paziente_base64: null,
  dimissione_firma_medico_base64: null,
  dimesso_at: null,
  invio_ps_missione_areu: null,
  invio_ps_data_ora: null,
  invio_ps_mezzo: '',
  invio_ps_ospedale: '',
  invio_ps_codice_trasporto: null,
  invio_ps_note: '',
  infermiere_rif: '',
  medico_rif: '',
  ingresso_carico_at: null,
};

function coloreSanitarioToPmaCodice(codice) {
  const m = {
    Bianco: 'bianco',
    Verde: 'verde',
    Giallo: 'giallo',
    Rosso: 'rosso',
  };
  return m[String(codice ?? '').trim()] ?? null;
}

function seedFromPazienteEvento(paziente, evento) {
  const seed = {};
  if (evento) {
    seed.tipo_evento = String(evento.tipoEvento ?? '').trim();
    seed.dettaglio_evento = String(evento.dettaglioEvento ?? '').trim();
  }
  const fromMsb = coloreSanitarioToPmaCodice(paziente.codiceColoreSanitario);
  if (fromMsb) seed.codice_colore = fromMsb;
  return seed;
}

function pazienteCollegatoAMissione(p, missione) {
  const sameEvento =
    (missione.eventoIdUnivoco && p.eventoIdUnivoco === missione.eventoIdUnivoco) ||
    p.eventoCorrelato === missione.eventoCorrelato;
  return (
    sameEvento &&
    p.mezzo === missione.mezzo &&
    p.esito === ESITO_TRASPORTA &&
    String(p.destinazionePmaId ?? '').trim()
  );
}

/** Allinea admin sync al client `patchPazienteArrivatoHConPma`. */
export function buildArrivatoHPatchAdmin(paziente, evento = null) {
  if (paziente.esito !== ESITO_TRASPORTA || paziente.stato === 'ARRIVATO H') return null;

  const patch = {
    stato: 'ARRIVATO H',
    arrivatoHAt: FieldValue.serverTimestamp(),
    aperta: false,
  };

  const pmaDest = String(paziente.destinazionePmaId ?? '').trim();
  if (pmaDest) {
    const cur = String(paziente.statoPzPma ?? '').trim();
    if (cur !== STATO_PZ_PMA.DIMESSO && cur !== STATO_PZ_PMA.IN_CARICO) {
      patch.statoPzPma = STATO_PZ_PMA.IN_ARRIVO;
    }
    patch.pmaId = paziente.pmaId ?? pmaDest;
    if (!paziente.pmaScheda) {
      patch.pmaScheda = {
        ...EMPTY_PMA_SCHEDA,
        ...seedFromPazienteEvento(paziente, evento),
      };
    }
  }

  return patch;
}

/** Allinea admin sync al client `syncPazientiPmaOnDirettoH`. */
export function buildDirettoHPatchAdmin(paziente) {
  if (!pazienteCollegatoAMissione(paziente, { mezzo: paziente.mezzo, eventoIdUnivoco: paziente.eventoIdUnivoco, eventoCorrelato: paziente.eventoCorrelato })) {
    return null;
  }
  return {
    tipoPz: paziente.tipoPz ?? 'CENTRALE',
    pmaId: paziente.pmaId ?? paziente.destinazionePmaId ?? '',
    statoPzPma: STATO_PZ_PMA.IN_ARRIVO,
  };
}

export function pazienteMatchesMissioneTrasporto(p, missione) {
  const sameEvento =
    (missione.eventoIdUnivoco && p.eventoIdUnivoco === missione.eventoIdUnivoco) ||
    p.eventoCorrelato === missione.eventoCorrelato;
  return sameEvento && p.mezzo === missione.mezzo && p.esito === ESITO_TRASPORTA;
}

export { pazienteCollegatoAMissione, seedFromPazienteEvento, EMPTY_PMA_SCHEDA };
