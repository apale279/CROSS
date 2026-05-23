import { useCallback, useEffect, useState } from 'react';
import { useManifestazioneId } from '../../context/ManifestazioneContext';
import { useImpostazioni } from '../../hooks/useImpostazioni';
import { listaPmaImpostazioni } from '../../lib/pmaModule';
import { ACCESS_TYPE, PMA_RANK, PMA_RANK_LABEL } from '../../lib/userAccess';
import {
  createAdminUser,
  deleteAdminUser,
  fetchAdminUsers,
  updateAdminUser,
} from '../../services/adminUsersService';
import { btnPrimary, btnSecondary, inputClass, selectClass } from '../ui/FormField';

const emptyForm = () => ({
  uid: '',
  email: '',
  password: '',
  nome: '',
  nomeUtente: '',
  accessType: ACCESS_TYPE.CENTRALE,
  pmaRank: PMA_RANK.MEDICO,
  pmaScopeId: '',
});

export function UserAccountsEditor() {
  const manifestationId = useManifestazioneId();
  const { impostazioni } = useImpostazioni();
  const pmaList = listaPmaImpostazioni(impostazioni);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminUsers(manifestationId);
      setRows(data.users ?? []);
    } catch (err) {
      setError(err.message ?? 'Errore caricamento utenti');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [manifestationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openNew = () => {
    setEditing(false);
    setForm(emptyForm());
  };

  const openEdit = (row) => {
    setEditing(true);
    setForm({
      uid: row.uid,
      email: row.email ?? '',
      password: '',
      nome: row.nome ?? '',
      nomeUtente: row.nomeUtente ?? '',
      accessType: row.accessType === ACCESS_TYPE.PMA ? ACCESS_TYPE.PMA : ACCESS_TYPE.CENTRALE,
      pmaRank: row.pmaRank || PMA_RANK.MEDICO,
      pmaScopeId: row.pmaScopeId ?? '',
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await updateAdminUser(manifestationId, { ...form, password: form.password || undefined });
      } else {
        await createAdminUser(manifestationId, form);
      }
      setForm(emptyForm());
      setEditing(false);
      await load();
    } catch (err) {
      setError(err.message ?? 'Salvataggio fallito');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (uid) => {
    if (!window.confirm('Eliminare questo utente? L’accesso Firebase Auth verrà revocato.')) return;
    try {
      await deleteAdminUser(manifestationId, uid);
      await load();
    } catch (err) {
      alert(err.message ?? 'Eliminazione fallita');
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Account operatori</h3>
          <p className="mt-1 text-sm text-slate-600">
            Crea e gestisci accessi web: centrale (dashboard completa) o PMA (vista tendone + rank).
          </p>
        </div>
        <button type="button" className={btnSecondary} onClick={() => void load()}>
          Aggiorna
        </button>
      </div>

      {error && (
        <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}

      <form onSubmit={(e) => void submit(e)} className="mb-6 rounded-lg border border-violet-100 bg-violet-50/40 p-4">
        <h4 className="mb-3 text-sm font-bold uppercase text-violet-900">
          {editing ? 'Modifica utente' : 'Nuovo utente'}
        </h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-bold text-slate-700">
            Email
            <input
              type="email"
              required
              className={`${inputClass} mt-1`}
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </label>
          <label className="block text-xs font-bold text-slate-700">
            Password {editing && '(vuoto = invariata)'}
            <input
              type="password"
              className={`${inputClass} mt-1`}
              value={form.password}
              required={!editing}
              minLength={6}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
          </label>
          <label className="block text-xs font-bold text-slate-700">
            Nome visualizzato
            <input
              className={`${inputClass} mt-1`}
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
            />
          </label>
          <label className="block text-xs font-bold text-slate-700">
            Nome utente (@)
            <input
              className={`${inputClass} mt-1`}
              value={form.nomeUtente}
              onChange={(e) => setForm((f) => ({ ...f, nomeUtente: e.target.value }))}
            />
          </label>
          <label className="block text-xs font-bold text-slate-700">
            Tipo accesso
            <select
              className={`${selectClass} mt-1`}
              value={form.accessType}
              onChange={(e) => setForm((f) => ({ ...f, accessType: e.target.value }))}
            >
              <option value={ACCESS_TYPE.CENTRALE}>Centrale</option>
              <option value={ACCESS_TYPE.PMA}>PMA</option>
            </select>
          </label>
          {form.accessType === ACCESS_TYPE.PMA && (
            <>
              <label className="block text-xs font-bold text-slate-700">
                Rank PMA
                <select
                  className={`${selectClass} mt-1`}
                  value={form.pmaRank}
                  onChange={(e) => setForm((f) => ({ ...f, pmaRank: e.target.value }))}
                >
                  {Object.entries(PMA_RANK_LABEL).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-bold text-slate-700 sm:col-span-2">
                PMA assegnato
                <select
                  className={`${selectClass} mt-1`}
                  value={form.pmaScopeId}
                  required
                  onChange={(e) => setForm((f) => ({ ...f, pmaScopeId: e.target.value }))}
                >
                  <option value="">— Seleziona PMA —</option>
                  {pmaList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="submit" className={btnPrimary} disabled={saving}>
            {saving ? 'Salvataggio…' : editing ? 'Salva modifiche' : 'Crea utente'}
          </button>
          {editing && (
            <button type="button" className={btnSecondary} onClick={openNew}>
              Annulla
            </button>
          )}
        </div>
      </form>

      {loading && <p className="text-sm text-slate-500">Caricamento…</p>}

      {!loading && rows.length === 0 && (
        <p className="text-sm text-slate-500">Nessun utente registrato.</p>
      )}

      {!loading && rows.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs font-bold uppercase text-slate-600">
                <th className="px-3 py-2">Nome</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">PMA / Rank</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.uid} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium">
                    {r.nome || '—'}
                    {r.nomeUtente && (
                      <span className="ml-1 font-mono text-xs text-slate-500">@{r.nomeUtente}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-700">{r.email || '—'}</td>
                  <td className="px-3 py-2">{r.accessType}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {r.accessType === ACCESS_TYPE.PMA
                      ? `${pmaList.find((p) => p.id === r.pmaScopeId)?.nome ?? r.pmaScopeId} · ${PMA_RANK_LABEL[r.pmaRank] ?? r.pmaRank}`
                      : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      className="text-violet-700 hover:underline"
                      onClick={() => openEdit(r)}
                    >
                      Modifica
                    </button>
                    <button
                      type="button"
                      className="ml-2 text-red-700 hover:underline"
                      onClick={() => void onDelete(r.uid)}
                    >
                      Elimina
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
