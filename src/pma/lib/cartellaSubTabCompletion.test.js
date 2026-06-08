import { describe, expect, it } from 'vitest';
import { cartellaSubTabCompiledMap } from './cartellaSubTabCompletion';

describe('cartellaSubTabCompiledMap', () => {
  it('non crasha con prestazioni_sel / rivalutazioni assenti', () => {
    const map = cartellaSubTabCompiledMap(
      {
        allergie_verifica: null,
        allergie: '',
        apr: '',
        app: '',
        eo_note: '',
        parametri_vitali: [],
        farmaci: [],
        lesioni: [],
        prestazioni_sel: undefined,
        ecg_cloudinary_url: null,
        rivalutazioni: undefined,
      },
      {
        GENERALE: [],
        NEUROLOGICO: [],
        TORACE: [],
        CUTE: [],
        ADDOME: [],
        'CAPO E COLLO': [],
      },
      false,
    );
    expect(map).toHaveProperty('anamnesi');
    expect(map).toHaveProperty('lesioni');
  });
});
