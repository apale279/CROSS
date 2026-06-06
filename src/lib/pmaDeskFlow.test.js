import { describe, expect, it } from 'vitest';
import {
  mettiInAttesaPmaStatoConsentito,
  pazienteColonnaPmaInArrivo,
  pazienteColonnaPmaInAttesa,
  pazienteColonnaPmaInCarico,
  STATO_PZ_PMA,
  TIPO_PZ,
} from './pmaModule';

const centraleInArrivo = {
  tipoPz: TIPO_PZ.CENTRALE,
  destinazionePmaId: 'pma1',
  statoPzPma: STATO_PZ_PMA.IN_ARRIVO,
};

const centraleLegacy = {
  tipoPz: TIPO_PZ.CENTRALE,
  destinazionePmaId: 'pma1',
  statoPzPma: null,
};

const autopresentato = {
  tipoPz: TIPO_PZ.PMA,
  pmaId: 'pma1',
  statoPzPma: STATO_PZ_PMA.IN_ATTESA,
};

describe('colonne desk PMA', () => {
  it('centrale IN ARRIVO o legacy null → in arrivo', () => {
    expect(pazienteColonnaPmaInArrivo(centraleInArrivo)).toBe(true);
    expect(pazienteColonnaPmaInArrivo(centraleLegacy)).toBe(true);
    expect(pazienteColonnaPmaInAttesa(centraleInArrivo)).toBe(false);
  });

  it('autopresentato IN ATTESA → in attesa, non in arrivo', () => {
    expect(pazienteColonnaPmaInAttesa(autopresentato)).toBe(true);
    expect(pazienteColonnaPmaInArrivo(autopresentato)).toBe(false);
  });

  it('in carico separato da attesa e arrivo', () => {
    const inCarico = { ...centraleInArrivo, statoPzPma: STATO_PZ_PMA.IN_CARICO };
    expect(pazienteColonnaPmaInCarico(inCarico)).toBe(true);
    expect(pazienteColonnaPmaInArrivo(inCarico)).toBe(false);
    expect(pazienteColonnaPmaInAttesa(inCarico)).toBe(false);
  });

  it('dopo metti in attesa il paziente esce da in arrivo', () => {
    const inAttesa = { ...centraleInArrivo, statoPzPma: STATO_PZ_PMA.IN_ATTESA };
    expect(pazienteColonnaPmaInAttesa(inAttesa)).toBe(true);
    expect(pazienteColonnaPmaInArrivo(inAttesa)).toBe(false);
  });
});

describe('mettiInAttesaPmaStatoConsentito', () => {
  it('consente da IN ARRIVO e da stato null (legacy centrale)', () => {
    expect(mettiInAttesaPmaStatoConsentito(STATO_PZ_PMA.IN_ARRIVO)).toBe('ok');
    expect(mettiInAttesaPmaStatoConsentito(null)).toBe('ok');
  });

  it('idempotente se già IN ATTESA', () => {
    expect(mettiInAttesaPmaStatoConsentito(STATO_PZ_PMA.IN_ATTESA)).toBe('noop');
  });

  it('nega da in carico o dimesso', () => {
    expect(mettiInAttesaPmaStatoConsentito(STATO_PZ_PMA.IN_CARICO)).toBe('deny_in_carico');
    expect(mettiInAttesaPmaStatoConsentito(STATO_PZ_PMA.DIMESSO)).toBe('deny_dimesso');
  });
});
