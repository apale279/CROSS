import { describe, expect, it } from 'vitest';
import {
  esitoMissioneTerminaCopertura,
  normalizeEsitoMissione,
} from './missioneEsito';

describe('missioneEsito', () => {
  it('normalizza DIROTTATA in DIROTTATO', () => {
    expect(normalizeEsitoMissione('dirottata')).toBe('DIROTTATO');
  });

  it('INTERROTTA e DIROTTATO terminano la copertura', () => {
    expect(esitoMissioneTerminaCopertura('INTERROTTA')).toBe(true);
    expect(esitoMissioneTerminaCopertura('DIROTTATO')).toBe(true);
    expect(esitoMissioneTerminaCopertura('DIROTTATA')).toBe(true);
  });

  it('REGOLARE e NON TRASPORTA non terminano la copertura', () => {
    expect(esitoMissioneTerminaCopertura('REGOLARE')).toBe(false);
    expect(esitoMissioneTerminaCopertura('NON TRASPORTA')).toBe(false);
    expect(esitoMissioneTerminaCopertura('AVARIA')).toBe(false);
  });
});
