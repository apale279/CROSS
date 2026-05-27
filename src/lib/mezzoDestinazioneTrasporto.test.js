import { describe, expect, it } from 'vitest';
import {
  findDestinazioneTrasportoSuMezzoEvento,
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

  it('confronta stessa destinazione', () => {
    expect(
      stessaDestinazioneTrasporto(
        { ospedaleDestinazione: 'Ospedale X', destinazionePmaId: '' },
        { ospedaleDestinazione: 'ospedale x', destinazionePmaId: '' },
      ),
    ).toBe(true);
  });
});
