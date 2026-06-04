import { describe, expect, it } from 'vitest';
import {
  parseVitalNumericInput,
  vitalInputValue,
  vitalMeasuredOrNull,
} from './vitalNumeric.js';

describe('vitalNumeric', () => {
  it('vitalInputValue: null e 0 sono vuoti', () => {
    expect(vitalInputValue(null)).toBe('');
    expect(vitalInputValue(0)).toBe('');
    expect(vitalInputValue(36.5)).toBe(36.5);
  });

  it('parseVitalNumericInput: zero e vuoto → null', () => {
    expect(parseVitalNumericInput('')).toBe(null);
    expect(parseVitalNumericInput('0')).toBe(null);
    expect(parseVitalNumericInput('36,5', { min: 30, max: 45 })).toBe(36.5);
  });

  it('parseVitalNumericInput: temperatura 0 non diventa 30', () => {
    expect(parseVitalNumericInput('0', { min: 30, max: 45 })).toBe(null);
  });

  it('vitalMeasuredOrNull: legacy zero → null', () => {
    expect(vitalMeasuredOrNull(0)).toBe(null);
    expect(vitalMeasuredOrNull(0, { min: 30, max: 45 })).toBe(null);
    expect(vitalMeasuredOrNull(37, { min: 30, max: 45 })).toBe(37);
    expect(vitalMeasuredOrNull(80, { min: 0, max: 100, integer: true })).toBe(80);
  });
});
