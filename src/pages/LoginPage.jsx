import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTenantContext } from '../context/TenantContext';
import { TenantConfigMissing } from '../components/routing/TenantConfigMissing';
import { AppLogo } from '../components/brand/AppLogo';

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
  const { tenantId, loading: tenantLoading } = useTenantContext();
  const { user, login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (tenantLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="text-sm text-slate-600">Caricamento ambiente…</p>
      </div>
    );
  }

  if (!tenantId) {
    return <TenantConfigMissing />;
  }

  if (user) {
    return <Navigate to="/" replace />;
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
      await login({ email: email.trim(), password });
      navigate('/', { replace: true });
    } catch (err) {
      const msg = mapAuthError(err?.code) ?? err?.message ?? 'Accesso non riuscito.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-100 to-slate-200 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
        <div className="flex flex-col items-center gap-2">
          <AppLogo className="h-16 w-auto" />
          <p className="text-sm text-slate-600">Accesso operativo</p>
        </div>

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

        <p className="mt-3 text-center text-xs text-slate-500">
          La sessione resta attiva su questo dispositivo fino al logout.
        </p>
      </div>
    </div>
  );
}
