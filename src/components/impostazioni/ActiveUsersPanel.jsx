import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useManifestazioneId } from '../../context/ManifestazioneContext';
import { fetchActiveWebUsers } from '../../services/activeUsersService';
import { btnSecondary } from '../ui/FormField';

function formatWhen(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export function ActiveUsersPanel() {
  const manifestationId = useManifestazioneId();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [users, setUsers] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchActiveWebUsers(manifestationId);
      setUsers(data.users ?? []);
    } catch (err) {
      setError(err.message ?? 'Errore caricamento');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [manifestationId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <PanelHeader loading={loading} onRefresh={() => void load()} />

      {loading && <p className="text-sm text-slate-500">Caricamento…</p>}
      {error && <p className="text-sm text-red-700">{error}</p>}

      {!loading && !error && users.length === 0 && (
        <p className="text-sm text-slate-500">
          Nessun utente con sessione web attiva. Compare dopo il login finché non si fa logout o logout
          globale.
        </p>
      )}

      {!loading && !error && users.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs font-bold uppercase text-slate-600">
                <th className="px-3 py-2">Nome</th>
                <th className="px-3 py-2">Username</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Ultima attività</th>
                <th className="px-3 py-2">Pagina</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.uid} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium text-slate-900">{u.nome || '—'}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {u.nomeUtente ? `@${u.nomeUtente}` : '—'}
                  </td>
                  <td className="px-3 py-2 text-slate-700">{u.email || '—'}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {formatWhen(u.lastSeenAt ?? u.sessionUpdatedAt)}
                  </td>
                  <td
                    className="max-w-[140px] truncate px-3 py-2 font-mono text-xs text-slate-500"
                    title={u.lastPath ?? ''}
                  >
                    {u.lastPath || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-slate-100 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
            Totale sessioni attive: {users.length}
          </p>
        </div>
      )}
    </section>
  );
}

function PanelHeader({ loading, onRefresh }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">Utenti web attivi</h3>
        <p className="mt-0.5 text-sm text-slate-600">
          Operatori connessi all&apos;app (sessione non revocata). Per l&apos;equipaggio Telegram vedi tab
          Telegram.
        </p>
      </div>
      <button
        type="button"
        className={`${btnSecondary} inline-flex items-center gap-1.5`}
        disabled={loading}
        onClick={onRefresh}
      >
        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
        Aggiorna
      </button>
    </div>
  );
}
