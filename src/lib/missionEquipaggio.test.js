import { describe, expect, it } from 'vitest';
import { formatEquipaggioText } from './missionEquipaggio';

describe('formatEquipaggioText', () => {
  it('formatta ruoli con telefono', () => {
    const text = formatEquipaggioText({
      autista: { nome: 'Mario', cognome: 'Rossi', telefono: '333' },
      medico: { nome: '', cognome: '', telefono: '' },
      soccorritore1: { nome: 'Luigi', cognome: 'Verdi', telefono: '' },
      soccorritore2: { nome: '', cognome: '', telefono: '' },
    });
    expect(text).toContain('Autista: Mario Rossi — 333');
    expect(text).toContain('Soccorritore 1: Luigi Verdi');
    expect(text).not.toContain('Medico');
  });
});
