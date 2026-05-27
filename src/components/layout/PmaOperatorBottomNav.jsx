import { NavLink, useLocation } from 'react-router-dom';
import { ClipboardList, BookOpen, User, LogOut, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { usePmaAccess } from '../../hooks/usePmaAccess';
import { isPmaMedicoAccount } from '../../lib/userAccess';
import { usePmaFieldUx } from '../../pma/hooks/usePmaFieldUx';

const linkClass = ({ isActive }) =>
  `flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-bold uppercase tracking-wide ${
    isActive ? 'text-sky-700' : 'text-slate-600'
  }`;

/** Navigazione inferiore fissa per infermiere / soccorritore / medico PMA su smartphone e tablet. */
export function PmaOperatorBottomNav() {
  const fieldUx = usePmaFieldUx();
  const { scopeId } = usePmaAccess();
  const { profile, logout } = useAuth();
  const { pathname } = useLocation();

  if (!fieldUx) return null;

  const pmaBase = scopeId ? `/pma/${encodeURIComponent(scopeId)}` : '/pma';
  const onPazienteScheda = /^\/pma\/[^/]+\/paziente\//.test(pathname);

  if (onPazienteScheda) return null;

  const showAccount = isPmaMedicoAccount(profile);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-slate-300 bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_12px_rgb(15_23_42/0.08)]"
      aria-label="Navigazione PMA"
    >
      <NavLink to={pmaBase} end className={linkClass}>
        <ClipboardList className="h-5 w-5 shrink-0" aria-hidden />
        PMA
      </NavLink>
      <NavLink to="/diario" className={linkClass}>
        <BookOpen className="h-5 w-5 shrink-0" aria-hidden />
        Diario
      </NavLink>
      <NavLink to="/pazienti" className={linkClass}>
        <Users className="h-5 w-5 shrink-0" aria-hidden />
        Pazienti
      </NavLink>
      {showAccount ? (
        <NavLink to="/account" className={linkClass}>
          <User className="h-5 w-5 shrink-0" aria-hidden />
          Account
        </NavLink>
      ) : null}
      <button
        type="button"
        className="flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-bold uppercase tracking-wide text-slate-600"
        onClick={() => void logout()}
      >
        <LogOut className="h-5 w-5 shrink-0" aria-hidden />
        Esci
      </button>
    </nav>
  );
}
