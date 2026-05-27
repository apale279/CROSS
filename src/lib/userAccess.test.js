import { describe, expect, it } from 'vitest';
import { userCanEditImpostazioni } from './userAccess';

describe('userCanEditImpostazioni', () => {
  it('superadmin può sempre modificare', () => {
    expect(userCanEditImpostazioni({ canEditImpostazioni: false }, true)).toBe(true);
  });

  it('centrale esistente senza flag può modificare (default)', () => {
    expect(userCanEditImpostazioni({ accessType: 'CENTRALE' }, false)).toBe(true);
    expect(userCanEditImpostazioni({}, false)).toBe(true);
  });

  it('centrale con canEditImpostazioni false è sola lettura', () => {
    expect(
      userCanEditImpostazioni({ accessType: 'CENTRALE', canEditImpostazioni: false }, false),
    ).toBe(false);
  });

  it('operatore PMA non modifica impostazioni globali', () => {
    expect(
      userCanEditImpostazioni(
        { accessType: 'PMA', pmaRank: 'INFERMIERE', pmaScopeId: 'p1' },
        false,
      ),
    ).toBe(false);
  });
});
