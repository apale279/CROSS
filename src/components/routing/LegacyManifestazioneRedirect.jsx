import { Navigate, useLocation } from 'react-router-dom';

/** Reindirizza vecchi URL `/manifestazione/:id/…` verso le nuove route piatte. */
export function LegacyManifestazioneRedirect() {
  const { pathname } = useLocation();
  const rest = pathname.replace(/^\/manifestazione\/[^/]+/, '') || '/';
  return <Navigate to={rest} replace />;
}
