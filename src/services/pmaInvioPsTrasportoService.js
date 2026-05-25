import { createEvento } from './eventiService';
import { createMissione } from './missioniService';
import { invioPsSoreuFieldsFromScheda } from '../lib/invioPsSoreu';
import { normalizeStatoPzPma, STATO_PZ_PMA } from '../lib/pmaModule';
import { createMissioneConConfermaRientro } from '../lib/missioneRientroCreate';
import {
  missionePmaInvioPsApertaPerPaziente,
  TIPO_TRASPORTO_MISSIONE_PMA_INVIO_PS,
} from '../lib/pmaInvioPsMission';

function labelPaziente(paziente) {
  const nome = [paziente.cognome, paziente.nome].filter(Boolean).join(' ');
  return nome || paziente.idPaziente || 'Paziente';
}

function coloreDaCodiceTrasporto(codice) {
  const m = { verde: 'Verde', giallo: 'Giallo', rosso: 'Rosso' };
  return m[String(codice ?? '').toLowerCase()] ?? 'Bianco';
}

/**
 * Evento + missione IN POSTO al PMA, con snapshot paziente dimesso (nessun nuovo paziente).
 */
export async function createTrasportoInvioPsDaPma(
  manifestationId,
  { paziente, pma, mezzo, mezzoDoc, eventi, missioni },
  { confirmFn } = {},
) {
  if (!manifestationId || !paziente?._docId || !pma || !mezzo) {
    throw new Error('Dati insufficienti per creare il trasporto.');
  }

  if (normalizeStatoPzPma(paziente.statoPzPma) !== STATO_PZ_PMA.DIMESSO) {
    throw new Error('Il paziente deve essere dimesso dal PMA prima di creare il trasporto.');
  }

  if (paziente.pmaScheda?.dimissione_esito !== 'invio_ps') {
    throw new Error('Esito dimissione non valido per il trasporto in PS.');
  }

  const esistente = missionePmaInvioPsApertaPerPaziente(missioni, paziente._docId);
  if (esistente) {
    throw new Error(
      `Esiste già un trasporto aperto (missione ${esistente.idMissione ?? '—'}). ` +
        'Apri quella missione o chiudila prima di crearne un altro.',
    );
  }

  const scheda = paziente.pmaScheda ?? {};
  const soreu = invioPsSoreuFieldsFromScheda(scheda);
  const ospedale =
    String(scheda.invio_ps_ospedale ?? paziente.ospedaleDestinazione ?? '').trim() || 'Ospedale';
  const noteLines = [
    `Trasporto PMA → PS — paziente ${paziente.idPaziente ?? ''} ${labelPaziente(paziente)}`.trim(),
    ospedale ? `Destinazione: ${ospedale}` : '',
    soreu.soreuNumeroMissione ? `N° missione SOREU: ${soreu.soreuNumeroMissione}` : '',
  ].filter(Boolean);

  const evento = await createEvento(
    manifestationId,
    {
      indirizzo: pma.indirizzo ?? '',
      luogo_fisico: pma.luogo_fisico ?? pma.nome ?? '',
      coordinate: pma.coordinate ?? null,
      tipoEvento: 'Trasporto',
      dettaglioEvento: 'PMA → Ospedale (Invio PS)',
      colore: coloreDaCodiceTrasporto(scheda.invio_ps_codice_trasporto),
      chiamante: pma.nome ?? 'PMA',
      noteEvento: noteLines.join('\n'),
    },
    eventi,
  );

  const missione = await createMissioneConConfermaRientro(
    createMissione,
    manifestationId,
    {
      eventoDocId: evento.docId,
      eventoIdUnivoco: evento.idUnivoco,
      eventoCorrelato: evento.idEvento,
      mezzo,
      statoInizialeForzato: 'IN POSTO',
      coloreEvento: coloreDaCodiceTrasporto(scheda.invio_ps_codice_trasporto),
      tipoTrasporto: TIPO_TRASPORTO_MISSIONE_PMA_INVIO_PS,
      noteMissione: noteLines.join('\n'),
      pazienteRiferimento: {
        docId: paziente._docId,
        idPaziente: paziente.idPaziente ?? '',
        idUnivoco: paziente.idUnivoco ?? '',
        cognome: paziente.cognome ?? '',
        nome: paziente.nome ?? '',
        pettorale: paziente.pettorale ?? null,
        ospedaleDestinazione: ospedale,
        originePmaId: pma.id ?? '',
        originePmaNome: pma.nome ?? '',
      },
    },
    missioni,
    mezzoDoc,
    [],
    confirmFn,
  );

  if (!missione) {
    throw new Error('Creazione trasporto annullata.');
  }

  return {
    evento: { _docId: evento.docId, idEvento: evento.idEvento, idUnivoco: evento.idUnivoco },
    missione: {
      _docId: missione.docId,
      idMissione: missione.idMissione,
      idUnivoco: missione.idUnivoco,
      mezzo,
      eventoIdUnivoco: evento.idUnivoco,
      eventoCorrelato: evento.idEvento,
    },
  };
}
