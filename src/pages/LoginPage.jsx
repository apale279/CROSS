import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTenantContext } from '../context/TenantContext';
import { TenantConfigMissing } from '../components/routing/TenantConfigMissing';

function mapAuthError(code) {
  switch (code) {
    case 'auth/invalid-email':
      return 'Email o nome utente non valido.';
    case 'auth/user-disabled':
      return 'Account disabilitato.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Nome utente o password non corretti.';
    case 'auth/email-already-in-use':
      return 'Questo nome utente è già registrato per questa manifestazione.';
    case 'auth/weak-password':
      return 'La password deve essere di almeno 6 caratteri.';
    case 'auth/operation-not-allowed':
      return 'Accesso con email/password non abilitato nel progetto Firebase (Console → Authentication).';
    case 'auth/network-request-failed':
      return 'Errore di rete. Riprova.';
    default:
      return null;
  }
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { tenantId, loading: tenantLoading } = useTenantContext();
  const { user, register, login } = useAuth();

  const [mode, setMode] = useState('login');
  const [nome, setNome] = useState('');
  const [nomeUtente, setNomeUtente] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const from = location.state?.from && location.state.from !== '/login' ? location.state.from : '/';

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
    return <Navigate to={from} replace />;
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (mode === 'register') {
      if (!nome.trim()) {
        setError('Inserisci il nome.');
        return;
      }
      if (password.length < 6) {
        setError('La password deve essere di almeno 6 caratteri.');
        return;
      }
      if (password !== password2) {
        setError('Le password non coincidono.');
        return;
      }
    } else if (password.length < 6) {
      setError('La password deve essere di almeno 6 caratteri.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'register') {
        await register({ nome: nome.trim(), nomeUtente, password });
      } else {
        await login({ nomeUtente, password });
      }
      navigate(from, { replace: true });
    } catch (err) {
      const msg = mapAuthError(err?.code) ?? err?.message ?? 'Operazione non riuscita.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-100 to-slate-200 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
        <h1 className="text-center text-2xl font-black tracking-tight text-sky-700">CROSS</h1>
        <p className="mt-1 text-center text-sm text-slate-600">Accesso operativo</p>

        <div className="mt-6 flex rounded-lg border border-slate-200 p-0.5 text-sm font-bold">
          <button
            type="button"
            className={`flex-1 rounded-md py-2 ${
              mode === 'login' ? 'bg-sky-600 text-white shadow' : 'text-slate-600 hover:bg-slate-50'
            }`}
            onClick={() => {
              setMode('login');
              setError(null);
            }}
          >
            Accedi
          </button>
          <button
            type="button"
            className={`flex-1 rounded-md py-2 ${
              mode === 'register'
                ? 'bg-sky-600 text-white shadow'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
            onClick={() => {
              setMode('register');
              setError(null);
            }}
          >
            Nuovo utente
          </button>
        </div>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          {mode === 'register' && (
            <div>
              <label htmlFor="login-nome" className="mb-1 block text-xs font-bold uppercase text-slate-600">
                Nome
              </label>
              <input
                id="login-nome"
                type="text"
                autoComplete="name"
                value={nome}
                onChange={(ev) => setNome(ev.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-sky-500 focus:ring-2"
                placeholder="Nome e cognome"
              />
            </div>
          )}
          <div>
            <label htmlFor="login-user" className="mb-1 block text-xs font-bold uppercase text-slate-600">
              Nome utente
            </label>
            <input
              id="login-user"
              type="text"
              autoComplete="username"
              value={nomeUtente}
              onChange={(ev) => setNomeUtente(ev.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm outline-none ring-sky-500 focus:ring-2"
              placeholder="es. mario.rossi"
            />
          </div>
          <div>
            <label htmlFor="login-pass" className="mb-1 block text-xs font-bold uppercase text-slate-600">
              Password
            </label>
            <input
              id="login-pass"
              type="password"
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-sky-500 focus:ring-2"
            />
          </div>
          {mode === 'register' && (
            <div>
              <label htmlFor="login-pass2" className="mb-1 block text-xs font-bold uppercase text-slate-600">
                Ripeti password
              </label>
              <input
                id="login-pass2"
                type="password"
                autoComplete="new-password"
                value={password2}
                onChange={(ev) => setPassword2(ev.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-sky-500 focus:ring-2"
              />
            </div>
          )}

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-sky-600 py-2.5 text-sm font-bold uppercase tracking-wide text-white hover:bg-sky-700 disabled:opacity-60"
          >
            {submitting ? 'Attendere…' : mode === 'register' ? 'Crea account e accedi' : 'Entra'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-500">
          La sessione resta attiva su questo dispositivo fino al logout. Navigazione e accessi sono registrati in
          Firestore nella sotto-collezione{' '}
          <code className="rounded bg-slate-100 px-1 font-mono text-[10px]">activityLog</code> della manifestazione.
        </p>
      </div>
    </div>
  );
}
