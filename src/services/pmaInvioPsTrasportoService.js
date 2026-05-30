import { createEvento } from './eventiService';
import { createMissione } from './missioniService';
import { invioPsSoreuFieldsFromScheda } from '../lib/invioPsSoreu';
import { normalizeStatoPzPma, STATO_PZ_PMA } from '../lib/pmaModule';
import { createMissioneConConfermaRientro } from '../lib/missioneRientroCreate';
import { parseCodiceColoreOptional } from '../lib/codiciColore';
import { mergeOperatoreCreatoPayload } from '../lib/operatoreAudit';
import { coloreSanitarioToPmaCodice } from './pazientePmaMissionSync';
import {
  missionePmaInvioPsApertaPerPaziente,
  TIPO_TRASPORTO_MISSIONE_PMA_INVIO_PS,
} from '../lib/pmaInvioPsMission';

function labelPaziente(paziente) {
  const nome = [paziente.cognome, paziente.nome].filter(Boolean).join(' ');
  return nome || paziente.idPaziente || 'Paziente';
}

/** Colore clinico da codice PMA/sanitario (Bianco, Verde, Giallo, Rosso). */
function coloreDaCodiceTrasporto(codice) {
  const m = {
    bianco: 'Bianco',
    verde: 'Verde',
    giallo: 'Giallo',
    rosso: 'Rosso',
  };
  const key = String(codice ?? '').trim().toLowerCase();
  if (!key) return null;
  return parseCodiceColoreOptional(m[key]);
}

/** E/M/T da codice paziente PMA: invio PS → scheda → P centrale. */
export function resolveColorePazienteInvioPs(paziente) {
  const scheda = paziente?.pmaScheda ?? {};
  const fromInvioPs = coloreDaCodiceTrasporto(scheda.invio_ps_codice_trasporto);
  if (fromInvioPs) return fromInvioPs;
  const fromScheda = coloreDaCodiceTrasporto(scheda.codice_colore);
  if (fromScheda) return fromScheda;
  const fromSanitario = coloreSanitarioToPmaCodice(paziente?.codiceColoreSanitario);
  if (fromSanitario) return coloreDaCodiceTrasporto(fromSanitario);
  return null;
}

/**
 * Evento + missione IN POSTO al PMA, con snapshot paziente dimesso (nessun nuovo paziente).
 */
export async function createTrasportoInvioPsDaPma(
  manifestationId,
  { paziente, pma, mezzo, mezzoDoc, ospedaleDestinazione, eventi, missioni },
  { creatoDaUid, creatoDaNomeUtente, creatoDaNome } = {},
) {
  const audit = mergeOperatoreCreatoPayload({
    creatoDaUid,
    creatoDaNomeUtente,
    creatoDaNome,
  });
  if (!manifestationId || !paziente?._docId || !pma || !mezzo) {
    throw new Error('Dati insufficienti per creare il trasporto.');
  }

  const ospedale = String(
    ospedaleDestinazione ??
      paziente.pmaScheda?.invio_ps_ospedale ??
      paziente.ospedaleDestinazione ??
      '',
  ).trim();
  if (!ospedale) {
    throw new Error('Seleziona l\'ospedale di destinazione.');
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
  const colorePaziente = resolveColorePazienteInvioPs(paziente);
  const soreu = invioPsSoreuFieldsFromScheda(scheda);
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
      colore: colorePaziente ?? 'Bianco',
      chiamante: pma.nome ?? 'PMA',
      noteEvento: noteLines.join('\n'),
      ...audit,
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
      ...(colorePaziente
        ? {
            codiceColoreMissione: colorePaziente,
            codiceColoreTrasporto: colorePaziente,
          }
        : {}),
      tipoTrasporto: TIPO_TRASPORTO_MISSIONE_PMA_INVIO_PS,
      ospedaleDestinazione: ospedale,
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
      ...audit,
    },
    missioni,
    mezzoDoc,
  );

  return {
    ospedaleDestinazione: ospedale,
    evento: { _docId: evento.docId, idEvento: evento.idEvento, idUnivoco: evento.idUnivoco },
    missione: {
      _docId: missione.docId,
      idMissione: missione.idMissione,
      idUnivoco: missione.idUnivoco,
      mezzo,
      ospedaleDestinazione: ospedale,
      eventoIdUnivoco: evento.idUnivoco,
      eventoCorrelato: evento.idEvento,
    },
  };
}
