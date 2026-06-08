import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTenantContext } from '../context/TenantContext';
import { TenantConfigMissing } from '../components/routing/TenantConfigMissing';
import { AppLogo } from '../components/brand/AppLogo';
import { AppVersionBadge } from '../components/ui/AppVersionBadge';
import { getDefaultAppPath } from '../lib/defaultAppPath';
import { isPmaOperatorProfile } from '../lib/pmaModule';

function mapAuthError(code) {
  switch (code) {
    case 'auth/invalid-email':
      return 'Indirizzo email non valido.';
    case 'auth/user-disabled':
      return 'Account disabilitato.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Email o password non corretti.';
    case 'auth/weak-password':
      return 'La password deve essere di almeno 6 caratteri.';
    case 'auth/operation-not-allowed':
      return 'Accesso con email/password non abilitato nel progetto Firebase (Console → Authentication).';
    case 'auth/network-request-failed':
      return 'Errore di rete. Riprova.';
    case 'auth/too-many-requests':
      return 'Troppi tentativi. Riprova tra qualche minuto.';
    default:
      return null;
  }
}

function validateEmail(value) {
  const email = String(value ?? '').trim();
  if (!email) return "Inserisci l'indirizzo email.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Inserisci un indirizzo email valido.';
  }
  return null;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { tenantId, loading: tenantLoading } = useTenantContext();
  const { user, profile, profileLoading, loading: authLoading, login, logout } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState(null);
  const inactiveLogout = searchParams.get('inactive') === '1';

  useEffect(() => {
    if (authLoading || !user) return;
    if (searchParams.get('logout') === '1' || searchParams.get('forceLogout') === '1') {
      setLoggingOut(true);
      void logout()
        .catch((err) => {
          setError(err?.message ?? 'Logout non riuscito.');
        })
        .finally(() => {
          setLoggingOut(false);
          navigate('/login', { replace: true });
        });
    }
  }, [authLoading, user, searchParams, logout, navigate]);

  if (tenantLoading || authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="text-sm text-slate-600">Verifica sessione…</p>
      </div>
    );
  }

  if (!tenantId) {
    return <TenantConfigMissing />;
  }

  if (user) {
    const accessLabel = profile?.accessType
      ? String(profile.accessType).toUpperCase()
      : profileLoading
        ? '…'
        : 'profilo non caricato';

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-100 to-slate-200 px-4 py-10">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
          <div className="flex flex-col items-center gap-2">
            <AppLogo className="h-16 w-auto" />
            <p className="text-sm font-semibold text-slate-800">Sessione già attiva</p>
          </div>

          <div className="mt-6 space-y-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <p>
              Sei connesso come <strong>{user.email ?? 'utente'}</strong>
              {profile?.nome ? (
                <>
                  {' '}
                  (<span>{profile.nome}</span>)
                </>
              ) : null}
              .
            </p>
            <p className="text-xs text-amber-900/80">
              Tipo accesso: <strong>{accessLabel}</strong>
              {profileLoading ? ' — aggiornamento profilo…' : null}
            </p>
            <p className="text-xs leading-relaxed text-amber-900/80">
              Firebase mantiene la sessione su questo browser. Usa <strong>Forza logout</strong> per
              disconnetterti e accedere con un altro account.
            </p>
          </div>

          {error ? (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          ) : null}

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={loggingOut}
              onClick={() => navigate(getDefaultAppPath(profile), { replace: true })}
              className="flex-1 rounded-lg bg-sky-600 py-2.5 text-sm font-bold uppercase tracking-wide text-white hover:bg-sky-700 disabled:opacity-60"
            >
              {isPmaOperatorProfile(profile) ? 'Vai al PMA' : 'Continua alla dashboard'}
            </button>
            <button
              type="button"
              disabled={loggingOut}
              onClick={() => {
                setError(null);
                setLoggingOut(true);
                void logout()
                  .then(() => navigate('/login', { replace: true }))
                  .catch((err) => {
                    setError(err?.message ?? 'Logout non riuscito.');
                  })
                  .finally(() => setLoggingOut(false));
              }}
              className="flex-1 rounded-lg border border-red-300 bg-red-50 py-2.5 text-sm font-bold uppercase tracking-wide text-red-900 hover:bg-red-100 disabled:opacity-60"
            >
              {loggingOut ? 'Disconnessione…' : 'Forza logout'}
            </button>
          </div>

          {import.meta.env.DEV ? (
            <p className="mt-4 text-center text-xs text-slate-500">
              Scorciatoia dev:{' '}
              <Link to="/login?forceLogout=1" className="font-medium text-sky-700 underline">
                /login?forceLogout=1
              </Link>
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const emailErr = validateEmail(email);
    if (emailErr) {
      setError(emailErr);
      return;
    }
    if (password.length < 6) {
      setError('La password deve essere di almeno 6 caratteri.');
      return;
    }

    setSubmitting(true);
    try {
      const prof = await login({ email: email.trim(), password });
      navigate(getDefaultAppPath(prof), { replace: true });
    } catch (err) {
      const msg = mapAuthError(err?.code) ?? err?.message ?? 'Accesso non riuscito.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-100 to-slate-200 px-4 py-10">
      <div className="absolute left-3 top-3 z-10">
        <AppVersionBadge />
      </div>
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
        <div className="flex flex-col items-center gap-2">
          <AppLogo className="h-16 w-auto" />
          <p className="text-sm text-slate-600">Accesso operativo</p>
        </div>

        {inactiveLogout && (
          <p
            className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
            role="status"
          >
            Sessione terminata per inattività. Accedi di nuovo per continuare.
          </p>
        )}

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label htmlFor="login-email" className="mb-1 block text-xs font-bold uppercase text-slate-600">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-sky-500 focus:ring-2"
              placeholder="nome@esempio.it"
            />
          </div>
          <div>
            <label htmlFor="login-pass" className="mb-1 block text-xs font-bold uppercase text-slate-600">
              Password
            </label>
            <input
              id="login-pass"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-sky-500 focus:ring-2"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-sky-600 py-2.5 text-sm font-bold uppercase tracking-wide text-white hover:bg-sky-700 disabled:opacity-60"
          >
            {submitting ? 'Attendere…' : 'Entra'}
          </button>
        </form>

        <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
          Gli account sono creati solo dall&apos;amministratore in Firebase Authentication. Per assistenza
          contatta la centrale operativa.
        </p>

        <p className="mt-3 text-center text-xs leading-relaxed text-slate-500">
          Disconnessione automatica dopo inattività: 30 minuti da computer, 1 ora da telefono o
          tablet.
        </p>
      </div>
    </div>
  );
}
