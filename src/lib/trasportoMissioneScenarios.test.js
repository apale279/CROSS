import { describe, expect, it } from 'vitest';
import { ESITO_TRASPORTA, ESITO_ALTRO } from '../constants';
import { encodePmaDestinazioneSelectValue } from './pmaDestinazioneTrasporto';
import {
  destinazioneTrasportoKey,
  findDestinazioneTrasportoSuMezzoEvento,
  stessaDestinazioneTrasporto,
  validateDestinazionePerMezzo,
} from './mezzoDestinazioneTrasporto';
import { fieldsPerEsito, resolveMissionePaziente } from './pazienteRules';
import { pazientiTrasportoPerMissione } from './pazientiTrasportoQuery';

const evento = { idEvento: 'E1', idUnivoco: 'ev1' };
const impostazioni = {
  listaOspedali: ['Ospedale Lecco', 'Ospedale Como'],
  pma: [{ id: 'pma1', nome: 'PPI RESEGUP' }],
};

const missioneM1 = {
  idUnivoco: 'uid-m1',
  idMissione: 'M1',
  mezzo: 'BRAVO_1',
  eventoCorrelato: 'E1',
  aperta: true,
};

const missioneM2 = {
  idUnivoco: 'uid-m2',
  idMissione: 'M2',
  mezzo: 'BRAVO_1',
  eventoCorrelato: 'E1',
  aperta: true,
};

describe('trasportoMissioneScenarios', () => {
  describe('legame missione su paziente', () => {
    it('fieldsPerEsito Trasporta imposta missioneIdUnivoco e mezzo derivato', () => {
      const f = fieldsPerEsito(ESITO_TRASPORTA, { mezzo: 'BRAVO_1', missione: missioneM1 });
      expect(f.missioneIdUnivoco).toBe('uid-m1');
      expect(f.idMissione).toBe('M1');
      expect(f.mezzo).toBe('BRAVO_1');
      expect(f.stato).toBe('TRASPORTO');
    });

    it('fieldsPerEsito non trasporto azzera missione e destinazione', () => {
      const f = fieldsPerEsito('Non trasporta', { clearTrasporto: true });
      expect(f.missioneIdUnivoco).toBe('');
      expect(f.mezzo).toBe('');
      expect(f.destinazionePmaId).toBe('');
      expect(f.stato).toBe('ATTESA');
    });

    it('resolveMissionePaziente preferisce missioneIdUnivoco', () => {
      const missioni = [missioneM1, missioneM2];
      const hit = resolveMissionePaziente(
        missioni,
        { missioneIdUnivoco: 'uid-m2', idMissione: 'M2', eventoCorrelato: 'E1' },
        evento,
      );
      expect(hit?.idMissione).toBe('M2');
    });

    it('resolveMissionePaziente risolve per idMissione + evento senza mezzo', () => {
      const hit = resolveMissionePaziente(
        [missioneM1, missioneM2],
        { idMissione: 'M1', eventoCorrelato: 'E1' },
        evento,
      );
      expect(hit?.idUnivoco).toBe('uid-m1');
    });
  });

  describe('destinazione ospedale', () => {
    const p1Ospedale = {
      _docId: 'p1',
      eventoCorrelato: 'E1',
      esito: ESITO_TRASPORTA,
      missioneIdUnivoco: 'uid-m1',
      idMissione: 'M1',
      mezzo: 'BRAVO_1',
      ospedaleDestinazione: 'Ospedale Lecco',
    };

    it('stessa missione: secondo paziente eredita ospedale', () => {
      const ref = findDestinazioneTrasportoSuMezzoEvento({
        pazienti: [p1Ospedale],
        evento,
        mezzo: 'BRAVO_1',
        missione: missioneM1,
        excludeDocId: 'p2',
      });
      expect(ref?.ospedaleDestinazione).toBe('Ospedale Lecco');
    });

    it('stessa missione: blocca ospedale diverso', () => {
      const v = validateDestinazionePerMezzo({
        mezzo: 'BRAVO_1',
        nomeSelezionato: 'Ospedale Como',
        pazienti: [p1Ospedale],
        evento,
        missione: missioneM1,
        excludeDocId: 'p2',
        impostazioni,
      });
      expect(v.ok).toBe(false);
    });

    it('missione diversa stesso mezzo: ospedale indipendente', () => {
      const ref = findDestinazioneTrasportoSuMezzoEvento({
        pazienti: [p1Ospedale],
        evento,
        mezzo: 'BRAVO_1',
        missione: missioneM2,
        excludeDocId: 'p2',
      });
      expect(ref).toBeNull();

      const v = validateDestinazionePerMezzo({
        mezzo: 'BRAVO_1',
        nomeSelezionato: 'Ospedale Como',
        pazienti: [p1Ospedale],
        evento,
        missione: missioneM2,
        excludeDocId: 'p2',
        impostazioni,
      });
      expect(v.ok).toBe(true);
    });
  });

  describe('destinazione PMA clinico vs codice minore', () => {
    const p1PmaClinico = {
      _docId: 'p1',
      eventoCorrelato: 'E1',
      esito: ESITO_TRASPORTA,
      missioneIdUnivoco: 'uid-m1',
      idMissione: 'M1',
      mezzo: 'BRAVO_1',
      destinazionePmaId: 'pma1',
      percorsoCodiceMinore: false,
    };

    const p1CodiceMinore = {
      ...p1PmaClinico,
      percorsoCodiceMinore: true,
    };

    it('PMA clinico e codice minore sullo stesso pmaId sono destinazioni diverse', () => {
      expect(stessaDestinazioneTrasporto(p1PmaClinico, p1CodiceMinore)).toBe(false);
      expect(destinazioneTrasportoKey(p1PmaClinico)).not.toBe(
        destinazioneTrasportoKey(p1CodiceMinore),
      );
    });

    it('stessa missione: blocca passaggio da clinico a codice minore', () => {
      const v = validateDestinazionePerMezzo({
        mezzo: 'BRAVO_1',
        nomeSelezionato: encodePmaDestinazioneSelectValue('pma1', { codiceMinore: true }),
        pazienti: [p1PmaClinico],
        evento,
        missione: missioneM1,
        excludeDocId: 'p2',
        impostazioni,
      });
      expect(v.ok).toBe(false);
    });

    it('stessa missione: blocca passaggio da codice minore a clinico', () => {
      const v = validateDestinazionePerMezzo({
        mezzo: 'BRAVO_1',
        nomeSelezionato: encodePmaDestinazioneSelectValue('pma1', { codiceMinore: false }),
        pazienti: [p1CodiceMinore],
        evento,
        missione: missioneM1,
        excludeDocId: 'p2',
        impostazioni,
      });
      expect(v.ok).toBe(false);
    });

    it('stessa missione: consente stesso percorso codice minore', () => {
      const v = validateDestinazionePerMezzo({
        mezzo: 'BRAVO_1',
        nomeSelezionato: encodePmaDestinazioneSelectValue('pma1', { codiceMinore: true }),
        pazienti: [p1CodiceMinore],
        evento,
        missione: missioneM1,
        excludeDocId: 'p2',
        impostazioni,
      });
      expect(v.ok).toBe(true);
    });
  });

  describe('ospedale vs PMA sulla stessa missione', () => {
    it('blocca PMA se primo paziente va in ospedale', () => {
      const p1 = {
        _docId: 'p1',
        eventoCorrelato: 'E1',
        esito: ESITO_TRASPORTA,
        missioneIdUnivoco: 'uid-m1',
        mezzo: 'BRAVO_1',
        ospedaleDestinazione: 'Ospedale Lecco',
      };
      const v = validateDestinazionePerMezzo({
        mezzo: 'BRAVO_1',
        nomeSelezionato: encodePmaDestinazioneSelectValue('pma1', { codiceMinore: false }),
        pazienti: [p1],
        evento,
        missione: missioneM1,
        excludeDocId: 'p2',
        impostazioni,
      });
      expect(v.ok).toBe(false);
    });
  });

  describe('pazienti in trasporto per missione', () => {
    it('due pazienti stesso mezzo missioni diverse → isolati', () => {
      const pazienti = [
        {
          esito: ESITO_TRASPORTA,
          eventoCorrelato: 'E1',
          missioneIdUnivoco: 'uid-m1',
          mezzo: 'BRAVO_1',
          ospedaleDestinazione: 'Ospedale Lecco',
        },
        {
          esito: ESITO_TRASPORTA,
          eventoCorrelato: 'E1',
          missioneIdUnivoco: 'uid-m2',
          mezzo: 'BRAVO_1',
          ospedaleDestinazione: 'Ospedale Como',
        },
      ];
      expect(pazientiTrasportoPerMissione(pazienti, missioneM1)).toHaveLength(1);
      expect(pazientiTrasportoPerMissione(pazienti, missioneM1)[0].ospedaleDestinazione).toBe(
        'Ospedale Lecco',
      );
    });

    it('trova destinazione anche se paziente referenziato solo per missioneIdUnivoco', () => {
      const ref = findDestinazioneTrasportoSuMezzoEvento({
        pazienti: [
          {
            _docId: 'p1',
            eventoCorrelato: 'E1',
            esito: ESITO_TRASPORTA,
            missioneIdUnivoco: 'uid-m1',
            idMissione: 'M1',
            destinazionePmaId: 'pma1',
            percorsoCodiceMinore: true,
          },
        ],
        evento,
        mezzo: 'BRAVO_1',
        missione: missioneM1,
        excludeDocId: 'p2',
        impostazioni,
      });
      expect(ref?.destinazionePmaId).toBe('pma1');
      expect(ref?.percorsoCodiceMinore).toBe(true);
    });
  });

  describe('esiti non trasporto', () => {
    it('esito Altro non partecipa al blocco destinazione missione', () => {
      const p1 = {
        _docId: 'p1',
        eventoCorrelato: 'E1',
        esito: ESITO_ALTRO,
        missioneIdUnivoco: 'uid-m1',
        mezzo: 'BRAVO_1',
        ospedaleDestinazione: 'Ospedale Lecco',
      };
      const ref = findDestinazioneTrasportoSuMezzoEvento({
        pazienti: [p1],
        evento,
        mezzo: 'BRAVO_1',
        missione: missioneM1,
        excludeDocId: 'p2',
      });
      expect(ref).toBeNull();
    });
  });

  describe('sync missione ARRIVATO H / DIRETTO H (in-memory)', () => {
    it('pazientiTrasportoPerMissione: M1 ARRIVATO H non tocca pazienti M2 stesso mezzo', () => {
      const pazienti = [
        {
          _docId: 'p1',
          esito: ESITO_TRASPORTA,
          eventoCorrelato: 'E1',
          missioneIdUnivoco: 'uid-m1',
          mezzo: 'BRAVO_1',
          stato: 'TRASPORTO',
        },
        {
          _docId: 'p2',
          esito: ESITO_TRASPORTA,
          eventoCorrelato: 'E1',
          missioneIdUnivoco: 'uid-m2',
          mezzo: 'BRAVO_1',
          stato: 'TRASPORTO',
          destinazionePmaId: 'pma1',
        },
      ];
      const m1Only = pazientiTrasportoPerMissione(pazienti, missioneM1);
      expect(m1Only.map((p) => p._docId)).toEqual(['p1']);
      const m2Only = pazientiTrasportoPerMissione(pazienti, missioneM2);
      expect(m2Only.map((p) => p._docId)).toEqual(['p2']);
    });
  });
});
