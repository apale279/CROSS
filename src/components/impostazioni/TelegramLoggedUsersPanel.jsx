import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useManifestazioneId } from '../../context/ManifestazioneContext';
import { fetchTelegramLoggedUsers } from '../../services/telegramService';
import { btnSecondary } from '../ui/FormField';

export function TelegramLoggedUsersPanel() {
  const manifestationId = useManifestazioneId();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [botEnabled, setBotEnabled] = useState(false);
  const [users, setUsers] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTelegramLoggedUsers(manifestationId);
      setBotEnabled(data.botEnabled === true);
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
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Equipaggio loggato (bot)</h3>
          <p className="mt-0.5 text-sm text-slate-600">
            Utenti Telegram con mezzo assegnato e sessione valida. Destinatari di «Invia a tutti» dal
            diario.
          </p>
        </div>
        <button
          type="button"
          className={`${btnSecondary} inline-flex items-center gap-1.5`}
          disabled={loading}
          onClick={() => void load()}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
          Aggiorna
        </button>
      </div>

      {loading && <p className="text-sm text-slate-500">Caricamento…</p>}
      {error && <p className="text-sm text-red-700">{error}</p>}

      {!loading && !error && !botEnabled && (
        <p className="text-sm text-amber-800">Bot Telegram spento: nessun equipaggio raggiungibile.</p>
      )}

      {!loading && !error && botEnabled && users.length === 0 && (
        <p className="text-sm text-slate-500">
          Nessun equipaggio loggato. Serve <strong>/start</strong> e scelta mezzo su Telegram.
        </p>
      )}

      {!loading && !error && users.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs font-bold uppercase text-slate-600">
                <th className="px-3 py-2">Mezzo</th>
                <th className="px-3 py-2">Nome</th>
                <th className="px-3 py-2">Username</th>
                <th className="px-3 py-2">Chat ID</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.chatId} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-mono font-bold text-slate-900">{u.mezzo}</td>
                  <td className="px-3 py-2 text-slate-800">{u.firstName || '—'}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {u.username ? `@${u.username}` : '—'}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-500">{u.chatId}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-slate-100 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
            Totale: {users.length}
          </p>
        </div>
      )}
    </section>
  );
}
