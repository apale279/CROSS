import { useMemo, useState } from 'react';
import { Link, Navigate, useParams, useNavigate } from 'react-router-dom';
import { COLLECTIONS } from '../lib/firestorePaths';
import { useManifestazioneCollection } from '../hooks/useManifestazioneCollection';
import { usePmaAccess } from '../hooks/usePmaAccess';
import {
  findPmaById,
  pazienteVisibileInPmaDesk,
  STATO_PZ_PMA,
  TIPO_PZ,
} from '../lib/pmaModule';
import { useImpostazioni } from '../hooks/useImpostazioni';
import { useManifestazioneId } from '../context/ManifestazioneContext';
import { PmaPatientQuickForm } from '../components/pma/PmaPatientQuickForm';
import { PmaPatientReadonlyCard } from '../components/pma/PmaPatientReadonlyCard';
import { btnSecondary } from '../components/ui/FormField';

function sortPazientiPma(a, b) {
  const order = (p) => {
    if (p.tipoPz === TIPO_PZ.CENTRALE && p.statoPzPma === STATO_PZ_PMA.IN_ARRIVO) return 0;
    if (p.statoPzPma === STATO_PZ_PMA.IN_CARICO) return 1;
    if (p.tipoPz === TIPO_PZ.PMA) return 2;
    return 3;
  };
  const d = order(a) - order(b);
  if (d !== 0) return d;
  return String(b.idPaziente ?? '').localeCompare(String(a.idPaziente ?? ''), 'it');
}

function openPazientePath(pmaId, docId) {
  return `/pma/${encodeURIComponent(pmaId)}/paziente/${encodeURIComponent(docId)}`;
}

export default function PmaDeskPage() {
  const navigate = useNavigate();
  const { pmaId } = useParams();
  const decodedId = decodeURIComponent(pmaId ?? '');
  const manifestationId = useManifestazioneId();
  const { impostazioni } = useImpostazioni();
  const { accessiblePma, scopeId, fullCentrale } = usePmaAccess();
  const { data: pazienti, loading } = useManifestazioneCollection(COLLECTIONS.pazienti);
  const [showCreate, setShowCreate] = useState(false);

  const pma = useMemo(
    () => findPmaById(impostazioni, decodedId),
    [impostazioni, decodedId],
  );

  if (!pma) {
    return (
      <div className="p-8 text-sm text-slate-600">
        PMA non trovato.{' '}
        <Link to="/pma" className="text-sky-700 underline">
          Torna all&apos;elenco
        </Link>
      </div>
    );
  }

  if (scopeId && scopeId !== pma.id) {
    return <Navigate to={`/pma/${encodeURIComponent(scopeId)}`} replace />;
  }

  if (!accessiblePma.some((x) => x.id === pma.id)) {
    return <Navigate to="/pma" replace />;
  }

  const list = pazienti
    .filter((p) => pazienteVisibileInPmaDesk(p, pma.id))
    .sort(sortPazientiPma);

  const inArrivo = list.filter(
    (p) => p.tipoPz === TIPO_PZ.CENTRALE && p.statoPzPma === STATO_PZ_PMA.IN_ARRIVO,
  );
  const inCarico = list.filter((p) => p.statoPzPma === STATO_PZ_PMA.IN_CARICO);
  const altri = list.filter(
    (p) =>
      !inArrivo.includes(p) &&
      !inCarico.includes(p),
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          {fullCentrale && (
            <Link to="/pma" className="text-xs font-medium text-sky-700 hover:underline">
              ← Tutti i PMA
            </Link>
          )}
          <h1 className="text-2xl font-bold text-violet-950">{pma.nome}</h1>
          <p className="font-mono text-xs text-slate-500">ID PMA: {pma.id}</p>
        </div>
        <button type="button" className={btnSecondary} onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? 'Chiudi form' : '+ Paziente autopresentato'}
        </button>
      </div>

      {showCreate && (
        <div className="mb-6">
          <PmaPatientQuickForm
            manifestationId={manifestationId}
            pma={pma}
            allPazienti={pazienti}
            onCreated={() => setShowCreate(false)}
            onCancel={() => setShowCreate(false)}
          />
        </div>
      )}

      {loading && <p className="text-sm text-slate-500">Caricamento pazienti…</p>}

      {!loading && list.length === 0 && (
        <p className="rounded border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          Nessun paziente per questo PMA. Creane uno autopresentato o attendi un invio dalla centrale.
        </p>
      )}

      {inArrivo.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-bold uppercase text-amber-800">In arrivo (da centrale)</h2>
          <ul className="space-y-2">
            {inArrivo.map((p) => (
              <li key={p._docId}>
                <PmaPatientReadonlyCard paziente={p} pmaNome={pma.nome} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {inCarico.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-bold uppercase text-violet-800">In carico</h2>
          <ul className="space-y-2">
            {inCarico.map((p) => (
              <li key={p._docId}>
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => navigate(openPazientePath(pma.id, p._docId))}
                >
                  <PmaPatientReadonlyCard
                    paziente={p}
                    pmaNome={pma.nome}
                    highlight
                  />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {altri.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-bold uppercase text-slate-600">Altri</h2>
          <ul className="space-y-2">
            {altri.map((p) => (
              <li key={p._docId}>
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() =>
                    p.statoPzPma === STATO_PZ_PMA.IN_CARICO
                      ? navigate(openPazientePath(pma.id, p._docId))
                      : undefined
                  }
                  disabled={p.statoPzPma !== STATO_PZ_PMA.IN_CARICO}
                >
                  <PmaPatientReadonlyCard paziente={p} pmaNome={pma.nome} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
