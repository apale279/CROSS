import { useCallback, useEffect, useRef, useState } from 'react';
import { useManifestazioneId } from '../../context/ManifestazioneContext';
import { useImpostazioni } from '../../hooks/useImpostazioni';
import { listaPmaImpostazioni } from '../../lib/pmaModule';
import {
  ACCESS_TYPE,
  PMA_RANK,
  PMA_RANK_LABEL,
  normalizeCanEditImpostazioni,
} from '../../lib/userAccess';
import { useImpostazioniEdit } from '../../context/ImpostazioniEditContext';
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
  accessType: ACCESS_TYPE.PMA,
  pmaRank: PMA_RANK.MEDICO,
  pmaScopeId: '',
  canEditImpostazioni: true,
});

export function UserAccountsEditor() {
  const manifestationId = useManifestazioneId();
  const { canEdit: canEditImpostazioniUi } = useImpostazioniEdit();
  const { impostazioni } = useImpostazioni();
  const pmaList = listaPmaImpostazioni(impostazioni);
  const formRef = useRef(null);
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

  const scrollToForm = () => {
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const openNew = () => {
    setEditing(false);
    setForm(emptyForm());
    setError(null);
    scrollToForm();
  };

  const openEdit = (row) => {
    setEditing(true);
    setError(null);
    setForm({
      uid: row.uid ?? '',
      email: row.email ?? '',
      password: '',
      nome: row.nome ?? '',
      nomeUtente: row.nomeUtente ?? '',
      accessType:
        String(row.accessType ?? '').toUpperCase() === ACCESS_TYPE.PMA
          ? ACCESS_TYPE.PMA
          : ACCESS_TYPE.CENTRALE,
      pmaRank: row.pmaRank || PMA_RANK.MEDICO,
      pmaScopeId: row.pmaScopeId ?? '',
      canEditImpostazioni:
        String(row.accessType ?? '').toUpperCase() === ACCESS_TYPE.CENTRALE
          ? row.canEditImpostazioni !== false
          : false,
    });
    scrollToForm();
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        if (!form.uid) {
          throw new Error('UID utente mancante: ricarica la pagina e riprova.');
        }
        if (form.accessType === ACCESS_TYPE.PMA && !form.pmaScopeId) {
          throw new Error('Seleziona un PMA per utenti con accesso PMA.');
        }
        await updateAdminUser(manifestationId, {
          uid: form.uid,
          email: form.email,
          nome: form.nome,
          nomeUtente: form.nomeUtente,
          accessType: form.accessType,
          pmaRank: form.pmaRank,
          pmaScopeId: form.pmaScopeId,
          canEditImpostazioni:
            form.accessType === ACCESS_TYPE.CENTRALE ? form.canEditImpostazioni : false,
          password: form.password?.trim() ? form.password : undefined,
        });
      } else {
        if (!form.email?.trim()) throw new Error('Email obbligatoria.');
        if (!form.password || form.password.length < 6) {
          throw new Error('Password obbligatoria (minimo 6 caratteri).');
        }
        if (form.accessType === ACCESS_TYPE.PMA && !form.pmaScopeId) {
          throw new Error('Seleziona un PMA per utenti con accesso PMA.');
        }
        await createAdminUser(manifestationId, {
          ...form,
          canEditImpostazioni:
            form.accessType === ACCESS_TYPE.CENTRALE ? form.canEditImpostazioni : false,
        });
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

  const onDelete = async (row) => {
    const label = row.email || row.nome || row.uid;
    if (
      !window.confirm(
        `Eliminare l'account "${label}"?\n\nVerranno rimossi il profilo Firestore e l'utente Firebase Authentication (l'email potrà essere riutilizzata).`,
      )
    ) {
      return;
    }
    setError(null);
    try {
      await deleteAdminUser(manifestationId, row.uid);
      if (editing && form.uid === row.uid) {
        setForm(emptyForm());
        setEditing(false);
      }
      await load();
    } catch (err) {
      setError(err.message ?? 'Eliminazione fallita');
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Account operatori</h3>
          <p className="mt-1 text-sm text-slate-600">
            Gestione account web tramite Firebase Authentication e profili in Firestore
            (autorizzazioni centrale / PMA).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEditImpostazioniUi ? (
            <button type="button" className={btnSecondary} onClick={openNew}>
              Nuovo utente
            </button>
          ) : null}
          <button type="button" className={btnSecondary} onClick={() => void load()}>
            Aggiorna
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}

      {loading && <p className="mb-4 text-sm text-slate-500">Caricamento…</p>}

      {!loading && rows.length > 0 && (
        <div className="mb-6 overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs font-bold uppercase text-slate-600">
                <th className="px-3 py-2">Nome</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">PMA / Rank</th>
                <th className="px-3 py-2">Mod. imp.</th>
                <th className="px-3 py-2 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.uid}
                  className={`border-t border-slate-100 ${
                    editing && form.uid === r.uid ? 'bg-violet-50' : ''
                  }`}
                >
                  <td className="px-3 py-2 font-medium">
                    {r.nome || '—'}
                    {r.nomeUtente && (
                      <span className="ml-1 font-mono text-xs text-slate-500">@{r.nomeUtente}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-700">{r.email || '—'}</td>
                  <td className="px-3 py-2">{r.accessType}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {String(r.accessType).toUpperCase() === ACCESS_TYPE.PMA
                      ? `${pmaList.find((p) => p.id === r.pmaScopeId)?.nome ?? (r.pmaScopeId || '—')} · ${PMA_RANK_LABEL[r.pmaRank] ?? (r.pmaRank || '—')}`
                      : '—'}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {String(r.accessType).toUpperCase() === ACCESS_TYPE.CENTRALE
                      ? r.canEditImpostazioni !== false
                        ? 'Sì'
                        : 'Solo lettura'
                      : '—'}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {canEditImpostazioniUi ? (
                      <>
                        <button
                          type="button"
                          className="rounded px-2 py-1 font-semibold text-violet-800 hover:bg-violet-100"
                          onClick={() => openEdit(r)}
                        >
                          Modifica
                        </button>
                        <button
                          type="button"
                          className="ml-1 rounded px-2 py-1 font-semibold text-red-800 hover:bg-red-100"
                          onClick={() => void onDelete(r)}
                        >
                          Elimina
                        </button>
                      </>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && rows.length === 0 && (
        <p className="mb-4 text-sm text-slate-500">Nessun utente registrato.</p>
      )}

      {canEditImpostazioniUi && (
      <form
        ref={formRef}
        onSubmit={(e) => void submit(e)}
        className={`rounded-lg border p-4 ${
          editing
            ? 'border-violet-400 bg-violet-50 ring-2 ring-violet-200'
            : 'border-violet-100 bg-violet-50/40'
        }`}
      >
        <h4 className="mb-1 text-sm font-bold uppercase text-violet-900">
          {editing ? 'Modifica utente' : 'Nuovo utente'}
        </h4>
        {editing && (
          <p className="mb-3 font-mono text-xs text-slate-500">UID: {form.uid}</p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-bold text-slate-700">
            Email
            <input
              type="email"
              required={!editing}
              autoComplete="off"
              className={`${inputClass} mt-1`}
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </label>
          <label className="block text-xs font-bold text-slate-700">
            Password {editing && '(vuoto = invariata)'}
            <input
              type="password"
              autoComplete="new-password"
              className={`${inputClass} mt-1`}
              value={form.password}
              required={!editing}
              minLength={editing ? undefined : 6}
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
          <label className="block text-xs font-bold text-slate-700 sm:col-span-2">
            Tipo accesso
            <select
              className={`${selectClass} mt-1`}
              value={form.accessType}
              onChange={(e) => {
                const accessType = e.target.value;
                setForm((f) => ({
                  ...f,
                  accessType,
                  canEditImpostazioni:
                    accessType === ACCESS_TYPE.CENTRALE ? f.canEditImpostazioni : false,
                }));
              }}
            >
              <option value={ACCESS_TYPE.PMA}>PMA — solo PMA, Pazienti, Diario</option>
              <option value={ACCESS_TYPE.CENTRALE}>Centrale — vede tutto (dashboard completa)</option>
            </select>
            <span className="mt-1 block text-[11px] font-normal text-slate-500">
              Medico / Infermiere / Soccorritore in tenda: scegli <strong>PMA</strong> e assegna il PMA.
            </span>
          </label>
          {form.accessType === ACCESS_TYPE.CENTRALE && (
            <label className="flex cursor-pointer items-start gap-2 sm:col-span-2">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300"
                checked={form.canEditImpostazioni !== false}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    canEditImpostazioni: normalizeCanEditImpostazioni(e.target.checked),
                  }))
                }
              />
              <span className="text-xs text-slate-800">
                <strong className="uppercase">Modifica impostazioni</strong>
                <span className="mt-0.5 block font-normal text-slate-600">
                  Se disattivato, l&apos;utente centrale può consultare le impostazioni ma non
                  modificarle né gestire altri account.
                </span>
              </span>
            </label>
          )}
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
      )}

      {!canEditImpostazioniUi && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Il tuo account è in <strong>sola lettura</strong> sulle impostazioni: puoi consultare
          l&apos;elenco utenti ma non crearli o modificarli.
        </p>
      )}
    </section>
  );
}
