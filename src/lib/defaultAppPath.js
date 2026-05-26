import { IS_SUPERADMIN } from '../constants';
import { effectivePmaScopeId, isPmaOperatorProfile } from './pmaModule';

/** Prima pagina dopo login o su `/` per operatori PMA vs centrale. */
export function getDefaultAppPath(profile, isSuperAdmin = IS_SUPERADMIN) {
  if (!isPmaOperatorProfile(profile) && !effectivePmaScopeId(profile, isSuperAdmin)) {
    return '/';
  }
  const scopeId = effectivePmaScopeId(profile, isSuperAdmin);
  if (scopeId) return `/pma/${encodeURIComponent(scopeId)}`;
  return '/pma';
}
