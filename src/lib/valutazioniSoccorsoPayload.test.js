import { describe, expect, it } from 'vitest';
import { payloadValutazioneRow } from './valutazioniSoccorsoPayload';

function hasNestedArrays(value, path = '') {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      if (Array.isArray(value[i])) return `${path}[${i}]`;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      const hit = hasNestedArrays(child, path ? `${path}.${key}` : key);
      if (hit) return hit;
    }
  }
  return null;
}

describe('payloadValutazioneRow', () => {
  it('non produce array annidati con lesioni MSB', () => {
    const row = payloadValutazioneRow({
      tipo: 'MSB',
      msbDetails: { lesioni: [['Ginocchio', 'SN', 'Abrasione', 2]] },
    });
    expect(hasNestedArrays(row)).toBeNull();
    expect(row.msbDetails.lesioni).toEqual([
      { localizzazione: 'Ginocchio', lato: 'SN', tipologia: 'Abrasione', vas: 2 },
    ]);
  });

  it('non produce array annidati con lesioni MSA', () => {
    const row = payloadValutazioneRow({
      tipo: 'MSA',
      msaDetails: { lesioni: [['Braccio', 'DX', 'Lacerazione', 5]] },
    });
    expect(hasNestedArrays(row)).toBeNull();
    expect(row.msaDetails.lesioni[0].tipologia).toBe('Lacerazione');
  });
});
