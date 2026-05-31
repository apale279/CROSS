import { describe, expect, it } from 'vitest';
import {
  findDestinazioneTrasportoSuMezzoEvento,
  destinazioneTrasportoKey,
  stessaDestinazioneTrasporto,
  validateDestinazionePerMezzo,
} from './mezzoDestinazioneTrasporto';
import { ESITO_TRASPORTA } from '../constants';

const evento = { idEvento: 'E1', idUnivoco: 'u1' };

describe('mezzoDestinazioneTrasporto', () => {
  it('trova destinazione del primo paziente sul mezzo', () => {
    const ref = findDestinazioneTrasportoSuMezzoEvento({
      pazienti: [
        {
          _docId: 'p1',
          eventoCorrelato: 'E1',
          esito: ESITO_TRASPORTA,
          mezzo: 'MSB1',
          ospedaleDestinazione: 'Ospedale Lecco',
        },
      ],
      evento,
      mezzo: 'MSB1',
      excludeDocId: 'p2',
    });
    expect(ref?.label).toBe('Ospedale Lecco');
  });

  it('blocca destinazione diversa', () => {
    const pazienti = [
      {
        _docId: 'p1',
        eventoCorrelato: 'E1',
        esito: ESITO_TRASPORTA,
        mezzo: 'MSB1',
        ospedaleDestinazione: 'Ospedale Lecco',
      },
    ];
    const v = validateDestinazionePerMezzo({
      mezzo: 'MSB1',
      nomeSelezionato: 'Ospedale Como',
      pazienti,
      evento,
      excludeDocId: 'p2',
      impostazioni: { listaOspedali: ['Ospedale Lecco', 'Ospedale Como'], pma: [] },
    });
    expect(v.ok).toBe(false);
    expect(v.message).toContain('Ospedale Lecco');
  });

  it('non eredita destinazione da altra missione sullo stesso mezzo', () => {
    const pazienti = [
      {
        _docId: 'p1',
        eventoCorrelato: 'E1',
        esito: ESITO_TRASPORTA,
        mezzo: 'BRAVO1',
        missioneIdUnivoco: 'm1uid',
        idMissione: 'M1',
        ospedaleDestinazione: '',
        destinazionePmaId: 'pma1',
        percorsoCodiceMinore: true,
      },
    ];
    const missione2 = { idUnivoco: 'm2uid', idMissione: 'M2', mezzo: 'BRAVO1' };
    const ref = findDestinazioneTrasportoSuMezzoEvento({
      pazienti,
      evento,
      mezzo: 'BRAVO1',
      missione: missione2,
      excludeDocId: 'p2',
    });
    expect(ref).toBeNull();
  });

  it('condivide destinazione sulla stessa missione', () => {
    const pazienti = [
      {
        _docId: 'p1',
        eventoCorrelato: 'E1',
        esito: ESITO_TRASPORTA,
        mezzo: 'BRAVO1',
        missioneIdUnivoco: 'm1uid',
        idMissione: 'M1',
        ospedaleDestinazione: '',
        destinazionePmaId: 'pma1',
        percorsoCodiceMinore: true,
      },
    ];
    const missione1 = { idUnivoco: 'm1uid', idMissione: 'M1', mezzo: 'BRAVO1' };
    const ref = findDestinazioneTrasportoSuMezzoEvento({
      pazienti,
      evento,
      mezzo: 'BRAVO1',
      missione: missione1,
      excludeDocId: 'p2',
      impostazioni: { pma: [{ id: 'pma1', nome: 'PPI RESEGUP' }] },
    });
    expect(ref?.destinazionePmaId).toBe('pma1');
  });

  it('destinazioneTrasportoKey distingue PMA clinico e codice minore', () => {
    expect(
      destinazioneTrasportoKey({
        destinazionePmaId: 'pma1',
        percorsoCodiceMinore: false,
      }),
    ).toBe('pma:pma1:cl');
    expect(
      destinazioneTrasportoKey({
        destinazionePmaId: 'pma1',
        percorsoCodiceMinore: true,
      }),
    ).toBe('pma:pma1:cm');
  });
});
