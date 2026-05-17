import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useTenantContext } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import { useManifestazione } from '../../hooks/useManifestazione';
import { useImpostazioni } from '../../hooks/useImpostazioni';
import { useEventoScheda } from '../../context/EventoSchedaContext';
import { useFirestoreSync } from '../../context/FirestoreSyncContext';
import { resetDashboardLayout } from '../../lib/dashboardLayout';
import { useKioskPopOutContextOptional } from '../../context/KioskPopOutContext';
import { AppLogo } from '../brand/AppLogo';

const navClass = ({ isActive }) =>
  `rounded border px-3 py-2 text-sm font-bold uppercase tracking-wide ${
    isActive
      ? 'border-sky-600 bg-sky-600 text-white'
      : 'border-slate-300 bg-white text-slate-800 hover:border-slate-400'
  }`;

const navActiveClass =
  'rounded border border-sky-600 bg-sky-600 px-3 py-2 text-sm font-bold uppercase tracking-wide text-white';

const navButtonClass =
  'rounded border border-slate-300 bg-white px-3 py-2 text-sm font-bold uppercase tracking-wide text-slate-800 hover:border-slate-400';

function formatSyncTime(date) {
  if (!date) return '—';
  return date.toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function AppHeader() {
  const { pathname } = useLocation();
  const { tenantId } = useTenantContext();
  const { user, profile, logout } = useAuth();
  const { manifestazione } = useManifestazione();
  const { impostazioni } = useImpostazioni();
  const guidaPdfUrl = (impostazioni.guida_pdf_url ?? '').trim();
  const { openNuovoEvento } = useEventoScheda();
  const { online, lastSyncAt, error } = useFirestoreSync();
  const kioskPopOut = useKioskPopOutContextOptional();
  const [syncLabel, setSyncLabel] = useState('—');

  useEffect(() => {
    const tick = () => setSyncLabel(formatSyncTime(lastSyncAt));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lastSyncAt]);

  if (!tenantId) return null;

  const isDashboard = pathname === '/' || pathname === '';

  return (
    <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-300 bg-white px-4 py-2">
      <Link to="/" className="flex items-center gap-2">
        <AppLogo className="h-9 w-auto" />
      </Link>
      <div className="flex items-center gap-2">
        {manifestazione?.nome && (
          <span className="text-sm font-bold uppercase text-slate-800">{manifestazione.nome}</span>
        )}
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${
            online ? 'bg-emerald-500' : 'bg-red-500'
          }`}
          title={online ? 'Firestore connesso' : error ?? 'Firestore non raggiungibile'}
        />
        <span className="font-mono text-xs text-slate-500" title="Ultima sincronizzazione">
          {syncLabel}
        </span>
      </div>

      <nav className="ml-auto flex flex-wrap items-center gap-2">
        {user && (
          <div className="mr-1 flex max-w-[200px] flex-col items-end text-right">
            <span className="truncate text-xs font-bold text-slate-800" title={profile?.nome ?? user.displayName ?? ''}>
              {profile?.nome || user.displayName || 'Utente'}
            </span>
            {profile?.nomeUtente && (
              <span className="truncate font-mono text-[10px] text-slate-500">@{profile.nomeUtente}</span>
            )}
          </div>
        )}
        {isDashboard && (
          <button type="button" onClick={openNuovoEvento} className={navActiveClass}>
            Nuovo evento
          </button>
        )}
        <NavLink to="/" end className={navClass}>
          Dashboard
        </NavLink>
        <NavLink to="/diario" className={navClass}>
          Diario
        </NavLink>
        <NavLink to="/eventi" className={navClass}>
          Eventi
        </NavLink>
        <NavLink to="/missioni" className={navClass}>
          Missioni
        </NavLink>
        <NavLink to="/pazienti" className={navClass}>
          Pazienti
        </NavLink>
        <NavLink to="/mezzi" className={navClass}>
          Mezzi
        </NavLink>
        {guidaPdfUrl && (
          <a
            href={guidaPdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={navButtonClass}
            title="Apri guida operativa (PDF)"
          >
            Guida
          </a>
        )}
        <NavLink to="/impostazioni" className={navClass}>
          Impostazioni
        </NavLink>
        {isDashboard && (
          <button
            type="button"
            className={navButtonClass}
            onClick={() => {
              resetDashboardLayout(tenantId);
              kioskPopOut?.resetAllPanels();
            }}
          >
            Reset vista
          </button>
        )}
        <button
          type="button"
          className={navButtonClass}
          onClick={() => void logout()}
          title="Esci da questo dispositivo"
        >
          Logout
        </button>
      </nav>
    </header>
  );
}
