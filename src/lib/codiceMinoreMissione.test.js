import { describe, expect, it } from 'vitest';
import { TIPO_PZ } from './pmaModule';
import { missioneCorrelataCodiceMinore } from './codiceMinoreMissione';

describe('missioneCorrelataCodiceMinore', () => {
  const missioni = [
    {
      _docId: 'm-doc',
      idUnivoco: 'uid-m1',
      idMissione: 'M1',
      eventoCorrelato: 'E1',
      mezzo: 'BRAVO1',
      aperta: true,
    },
  ];
  const eventi = [{ _docId: 'ev1', idEvento: 'E1', idUnivoco: 'uid-e1' }];

  it('null per codice minore nativo senza trasporto', () => {
    expect(
      missioneCorrelataCodiceMinore(
        { tipoPz: TIPO_PZ.CODICE_MINORE, pettorale: 12, codiceMinore: {} },
        missioni,
        eventi,
      ),
    ).toBeNull();
  });

  it('risolve missione per paziente trasportato con missioneIdUnivoco', () => {
    const paziente = {
      tipoPz: TIPO_PZ.CODICE_MINORE,
      percorsoCodiceMinore: true,
      eventoCorrelato: 'E1',
      missioneIdUnivoco: 'uid-m1',
      mezzo: 'BRAVO1',
      destinazionePmaId: 'pma1',
    };
    expect(missioneCorrelataCodiceMinore(paziente, missioni, eventi)?._docId).toBe('m-doc');
  });

  it('null se missione non trovata', () => {
    const paziente = {
      percorsoCodiceMinore: true,
      eventoCorrelato: 'E1',
      missioneIdUnivoco: 'uid-altro',
      mezzo: 'BRAVO1',
    };
    expect(missioneCorrelataCodiceMinore(paziente, missioni, eventi)).toBeNull();
  });
});
