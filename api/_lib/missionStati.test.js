import { describe, expect, it } from 'vitest';
import {
  canEquipaggioAvanzareStatoDaTelegram,
  isMissioneModificabileSuTelegram,
  isStatoChiusuraMissioneEquipaggio,
  nextStatoMissione,
  shouldOfferTelegramStatoAdvanceButton,
} from './missionStati.js';

const STATI = [
  'ALLERTARE',
  'ALLERTATO',
  'PARTITO',
  'RIENTRO',
  'FINE MISSIONE',
  'ANNULLATA',
];

describe('missionStati equipaggio Telegram', () => {
  it('consente solo FINE MISSIONE come chiusura equipaggio', () => {
    expect(isStatoChiusuraMissioneEquipaggio('FINE MISSIONE')).toBe(true);
    expect(isStatoChiusuraMissioneEquipaggio('ANNULLATA')).toBe(false);
    expect(isStatoChiusuraMissioneEquipaggio('RIENTRO')).toBe(false);
  });

  it('blocca ANNULLATA e altri terminali da Telegram', () => {
    expect(canEquipaggioAvanzareStatoDaTelegram('ANNULLATA')).toBe(false);
    expect(canEquipaggioAvanzareStatoDaTelegram('FINE MISSIONE')).toBe(true);
    expect(canEquipaggioAvanzareStatoDaTelegram('RIENTRO')).toBe(true);
    expect(canEquipaggioAvanzareStatoDaTelegram('PARTITO')).toBe(true);
  });

  it('esclude ANNULLATA dalla sequenza avanti', () => {
    expect(nextStatoMissione('RIENTRO', STATI)).toBe('FINE MISSIONE');
    expect(nextStatoMissione('FINE MISSIONE', STATI)).toBe('FINE MISSIONE');
  });

  it('missione terminata non è modificabile su Telegram', () => {
    expect(isMissioneModificabileSuTelegram({ stato: 'PARTITO', aperta: true })).toBe(true);
    expect(isMissioneModificabileSuTelegram({ stato: 'FINE MISSIONE', aperta: false })).toBe(false);
    expect(isMissioneModificabileSuTelegram({ stato: 'ANNULLATA', aperta: false })).toBe(false);
    expect(isMissioneModificabileSuTelegram({ stato: 'RIENTRO', aperta: false })).toBe(false);
    expect(isMissioneModificabileSuTelegram(null)).toBe(false);
  });

  it('non offre pulsante avanzamento verso ANNULLATA', () => {
    expect(
      shouldOfferTelegramStatoAdvanceButton({
        stato: 'PARTITO',
        next: 'ANNULLATA',
        aperta: true,
      }),
    ).toBe(false);
    expect(
      shouldOfferTelegramStatoAdvanceButton({
        stato: 'RIENTRO',
        next: 'FINE MISSIONE',
        aperta: true,
      }),
    ).toBe(true);
  });
});
