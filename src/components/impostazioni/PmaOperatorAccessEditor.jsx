import { useCallback, useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { useManifestazioneId } from '../../context/ManifestazioneContext';
import { db } from '../../firebaseConfig';
import { COLLECTIONS } from '../../lib/firestorePaths';
import { listaPmaImpostazioni } from '../../lib/pmaModule';
import { useImpostazioni } from '../../hooks/useImpostazioni';
import { saveUserProfile } from '../../services/userProfileService';
import { btnSecondary, selectClass } from '../ui/FormField';

export function PmaOperatorAccessEditor() {
  const manifestationId = useManifestazioneId();
  const { impostazioni } = useImpostazioni();
  const pmaList = listaPmaImpostazioni(impostazioni);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingUid, setSavingUid] = useState(null);

  const load = useCallback(async () => {
    if (!manifestationId) return;
    setLoading(true);
    const snap = await getDocs(
      collection(db, COLLECTIONS.manifestazioni, manifestationId, 'userProfiles'),
    );
    setRows(
      snap.docs.map((d) => ({
        uid: d.id,
        nome: d.data().nome ?? '',
        nomeUtente: d.data().nomeUtente ?? '',
        pmaScopeId: d.data().pmaScopeId ?? '',
      })),
    );
    setLoading(false);
  }, [manifestationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onScopeChange = async (uid, pmaScopeId) => {
    setSavingUid(uid);
    try {
      const row = rows.find((r) => r.uid === uid);
      await saveUserProfile(manifestationId, uid, {
        nome: row?.nome ?? '',
        nomeUtente: row?.nomeUtente ?? '',
        pmaScopeId: pmaScopeId || '',
      });
      setRows((prev) =>
        prev.map((r) => (r.uid === uid ? { ...r, pmaScopeId: pmaScopeId || '' } : r)),
      );
    } catch (err) {
      alert(err.message ?? 'Errore salvataggio');
    } finally {
      setSavingUid(null);
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-500">Caricamento profili utente…</p>;
  }

  if (!rows.length) {
    return (
      <p className="text-sm text-slate-500">
        Nessun profilo utente web. Gli utenti compaiono dopo il primo login.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-50 text-left text-xs font-bold uppercase text-slate-600">
            <th className="px-3 py-2">Utente</th>
            <th className="px-3 py-2">Accesso PMA</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.uid} className="border-t border-slate-100">
              <td className="px-3 py-2">
                <span className="font-medium">{r.nome || r.nomeUtente || r.uid}</span>
                {r.nomeUtente && (
                  <span className="ml-1 font-mono text-xs text-slate-500">@{r.nomeUtente}</span>
                )}
              </td>
              <td className="px-3 py-2">
                <select
                  className={selectClass}
                  disabled={savingUid === r.uid}
                  value={r.pmaScopeId}
                  onChange={(e) => void onScopeChange(r.uid, e.target.value)}
                >
                  <option value="">Centrale (accesso completo)</option>
                  {pmaList.map((p) => (
                    <option key={p.id} value={p.id}>
                      Solo PMA — {p.nome}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-slate-100 bg-slate-50 px-3 py-2">
        <button type="button" className={btnSecondary} onClick={() => void load()}>
          Aggiorna elenco
        </button>
      </div>
    </div>
  );
}
