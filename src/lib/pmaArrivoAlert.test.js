import { describe, expect, it } from 'vitest';

import {

  detectNuoviDirettoHPma,

  isPazienteInArrivoDaCentrale,

  markPmaDirettoHNotified,

  MISSIONE_STATO_DIRETTO_H,

  pazienteInArrivoLabel,

  pmaDirettoHAlertKey,

  titoloAlertPmaArrivo,

} from './pmaArrivoAlert';

import { STATO_PZ_PMA, TIPO_PZ } from './pmaModule';



import { ESITO_TRASPORTA } from '../constants';

describe('pmaArrivoAlert', () => {
  const missioneBase = {
    idMissione: 'M1',
    idUnivoco: 'uid-m1',
    mezzo: 'BRAVO_1',
    eventoCorrelato: 'E1',
  };

  const pazienteVersoPma = (id, extra = {}) => ({
    _docId: id,
    esito: ESITO_TRASPORTA,
    mezzo: 'BRAVO_1',
    eventoCorrelato: 'E1',
    idMissione: 'M1',
    missioneIdUnivoco: 'uid-m1',
    destinazionePmaId: 'pma1',
    tipoPz: TIPO_PZ.CENTRALE,
    ...extra,
  });

  it('desk: IN ARRIVO e legacy senza stato', () => {

    expect(

      isPazienteInArrivoDaCentrale(

        {

          tipoPz: TIPO_PZ.CENTRALE,

          destinazionePmaId: 'pma1',

          statoPzPma: STATO_PZ_PMA.IN_ARRIVO,

        },

        'pma1',

      ),

    ).toBe(true);

    expect(

      isPazienteInArrivoDaCentrale(

        { tipoPz: TIPO_PZ.CENTRALE, destinazionePmaId: 'pma1', statoPzPma: null },

        'pma1',

      ),

    ).toBe(true);

  });



  it('notifica solo al passaggio DIRETTO H', () => {

    expect(titoloAlertPmaArrivo()).toBe('Mezzo in diretto verso PMA');



    const missioneInPosto = {
      id: 'm1',
      data: () => ({ ...missioneBase, stato: 'IN POSTO' }),
    };
    const missioneDiretto = {
      id: 'm1',
      data: () => ({
        ...missioneBase,
        stato: MISSIONE_STATO_DIRETTO_H,
      }),
    };
    const pazienti = [
      pazienteVersoPma('p1', { statoPzPma: STATO_PZ_PMA.IN_ARRIVO }),
    ];



    const primed = detectNuoviDirettoHPma([missioneInPosto], pazienti, ['pma1'], new Map(), false);

    expect(primed.incoming).toHaveLength(0);



    const alert = detectNuoviDirettoHPma(

      [missioneDiretto],

      pazienti,

      ['pma1'],

      primed.nextFlags,

      true,

    );

    expect(alert.incoming).toHaveLength(1);

    expect(alert.incoming[0].pazienti).toHaveLength(1);

  });



  it('raggruppa più pazienti nello stesso alert DIRETTO H', () => {

    const missioneInPosto = {
      id: 'm1',
      data: () => ({ ...missioneBase, stato: 'PARTITO' }),
    };
    const missioneDiretto = {
      id: 'm1',
      data: () => ({
        ...missioneBase,
        stato: MISSIONE_STATO_DIRETTO_H,
      }),
    };
    const pazienti = [pazienteVersoPma('p1'), pazienteVersoPma('p2')];

    const first = detectNuoviDirettoHPma([missioneInPosto], pazienti, ['pma1'], new Map(), false);

    const second = detectNuoviDirettoHPma(

      [missioneDiretto],

      pazienti,

      ['pma1'],

      first.nextFlags,

      true,

    );

    expect(second.incoming[0].pazienti).toHaveLength(2);

  });



  it('non ripete alert se già notificato per missione+PMA', () => {

    const missioneDiretto = {
      id: 'm1',
      data: () => ({
        ...missioneBase,
        stato: MISSIONE_STATO_DIRETTO_H,
      }),
    };
    const pazienti = [pazienteVersoPma('p1')];

    const notified = new Set([pmaDirettoHAlertKey('m1', 'pma1')]);

    const once = detectNuoviDirettoHPma(

      [missioneDiretto],

      pazienti,

      ['pma1'],

      new Map([['m1', false]]),

      true,

      notified,

    );

    expect(once.incoming).toHaveLength(0);

  });



  it('markPmaDirettoHNotified accumula chiavi', () => {

    const set = markPmaDirettoHNotified('tenant1', new Set(), ['diretto_h:m1:pma1']);

    expect(set.has('diretto_h:m1:pma1')).toBe(true);

  });



  it('etichetta paziente', () => {

    expect(

      pazienteInArrivoLabel({

        idPaziente: 'P12',

        cognome: 'Rossi',

        nome: 'Mario',

      }),

    ).toContain('Rossi');

  });

});

