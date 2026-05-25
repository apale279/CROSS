import { useMemo, useState } from 'react';
import { Link, Navigate, useParams, useNavigate } from 'react-router-dom';
import { COLLECTIONS } from '../lib/firestorePaths';
import { useManifestazioneCollection } from '../hooks/useManifestazioneCollection';
import { usePmaAccess } from '../hooks/usePmaAccess';
import { findEvento } from '../lib/eventoLinks';
import {
  findPmaById,
  pazienteDimessoInPmaDesk,
  pazienteVisibileInPmaDesk,
  pazientiCodiceMinorePerPma,
  STATO_PZ_PMA,
} from '../lib/pmaModule';
import { useImpostazioni } from '../hooks/useImpostazioni';
import { useManifestazioneId } from '../context/ManifestazioneContext';
import { Modal } from '../components/ui/Modal';
import { PmaPatientQuickForm } from '../components/pma/PmaPatientQuickForm';
import { PmaPatientReadonlyCard } from '../components/pma/PmaPatientReadonlyCard';
import { PmaInCaricoCard } from '../components/pma/PmaInCaricoCard';
import { PmaCodiciMinoriPanel } from '../components/pma/PmaCodiciMinoriPanel';
import { btnPrimary, btnSecondary } from '../components/ui/FormField';
import { prendiInCaricoPma } from '../services/pmaStatoService';
import {
  createPazienteCodiceMinore,
  deletePazienteCodiceMinore,
  updatePazienteCodiceMinore,
} from '../services/pmaCodiceMinoreService';

function openPazientePath(pmaId, docId) {
  return `/pma/${encodeURIComponent(pmaId)}/paziente/${encodeURIComponent(docId)}?tab=cartella`;
}

export default function PmaDeskPage() {
  const navigate = useNavigate();
  const { pmaId } = useParams();
  const decodedId = decodeURIComponent(pmaId ?? '');
  const manifestationId = useManifestazioneId();
  const { impostazioni } = useImpostazioni();
  const { accessiblePma, scopeId, fullCentrale } = usePmaAccess();
  const { data: pazienti, loading } = useManifestazioneCollection(COLLECTIONS.pazienti);
  const { data: eventi } = useManifestazioneCollection(COLLECTIONS.eventi);
  const [showCreate, setShowCreate] = useState(false);
  const [showCodiciMinori, setShowCodiciMinori] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [codiciBusy, setCodiciBusy] = useState(false);

  const pma = useMemo(
    () => findPmaById(impostazioni, decodedId),
    [impostazioni, decodedId],
  );

  const codiciMinori = useMemo(
    () => (pma ? pazientiCodiceMinorePerPma(pazienti, pma.id) : []),
    [pazienti, pma],
  );
  const [showDimessi, setShowDimessi] = useState(false);
  const dimessi = useMemo(
    () =>
      pma
        ? [...pazienti]
            .filter((p) => pazienteDimessoInPmaDesk(p, pma.id))
            .sort((a, b) => {
              const ta = a.pmaScheda?.dimesso_at?.toMillis?.() ?? a.apertura?.toMillis?.() ?? 0;
              const tb = b.pmaScheda?.dimesso_at?.toMillis?.() ?? b.apertura?.toMillis?.() ?? 0;
              return tb - ta;
            })
        : [],
    [pazienti, pma],
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

  const list = pazienti.filter((p) => pazienteVisibileInPmaDesk(p, pma.id));

  const inArrivo = list.filter((p) => p.statoPzPma === STATO_PZ_PMA.IN_ARRIVO);
  const inAttesa = list.filter((p) => p.statoPzPma === STATO_PZ_PMA.IN_ATTESA);
  const inCarico = list.filter((p) => p.statoPzPma === STATO_PZ_PMA.IN_CARICO);

  const eventoFor = (p) => findEvento(eventi, p.eventoIdUnivoco ?? p.eventoCorrelato);

  const handlePrendiInCarico = async (docId) => {
    setBusyId(docId);
    try {
      await prendiInCaricoPma(manifestationId, docId);
      navigate(openPazientePath(pma.id, docId));
    } catch (err) {
      alert(err?.message ?? 'Errore presa in carico');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="pma-viewport mx-auto flex min-h-[calc(100vh-8rem)] w-full min-w-0 max-w-[1600px] flex-col overflow-x-clip px-3 py-4 lg:px-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          {fullCentrale && (
            <Link to="/pma" className="text-xs font-medium text-sky-700 hover:underline">
              ← Tutti i PMA
            </Link>
          )}
          <h1 className="text-2xl font-bold text-slate-900">{pma.nome}</h1>
          <p className="font-mono text-xs text-slate-500">Posto medico avanzato — dashboard operativa</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnSecondary} onClick={() => setShowCodiciMinori(true)}>
            Tabella codici minori
          </button>
          <button type="button" className={btnSecondary} onClick={() => setShowCreate(true)}>
            + Paziente autopresentato
          </button>
        </div>
      </div>

      {showCreate && (
        <Modal title="Nuovo paziente autopresentato" wide onClose={() => setShowCreate(false)}>
          <PmaPatientQuickForm
            manifestationId={manifestationId}
            pma={pma}
            impostazioni={impostazioni}
            allPazienti={pazienti}
            onCreated={(result) => {
              setShowCreate(false);
              const id = result?.docId ?? result?._docId;
              if (id) navigate(openPazientePath(pma.id, id));
            }}
            onCancel={() => setShowCreate(false)}
          />
        </Modal>
      )}

      {showCodiciMinori && (
        <Modal title="Tabella codici minori" extraWide onClose={() => setShowCodiciMinori(false)}>
          <PmaCodiciMinoriPanel
            rows={codiciMinori}
            busy={codiciBusy}
            onCreate={async (payload) => {
              setCodiciBusy(true);
              try {
                await createPazienteCodiceMinore(
                  manifestationId,
                  pma.id,
                  pma.nome,
                  payload,
                  pazienti,
                );
              } catch (err) {
                alert(err?.message ?? 'Errore creazione');
                throw err;
              } finally {
                setCodiciBusy(false);
              }
            }}
            onUpdate={async (docId, payload) => {
              setCodiciBusy(true);
              try {
                await updatePazienteCodiceMinore(manifestationId, docId, payload);
              } catch (err) {
                alert(err?.message ?? 'Errore aggiornamento');
                throw err;
              } finally {
                setCodiciBusy(false);
              }
            }}
            onDelete={async (docId) => {
              setCodiciBusy(true);
              try {
                await deletePazienteCodiceMinore(manifestationId, docId);
              } catch (err) {
                alert(err?.message ?? 'Errore eliminazione');
                throw err;
              } finally {
                setCodiciBusy(false);
              }
            }}
          />
        </Modal>
      )}

      {loading && <p className="text-sm text-slate-500">Caricamento pazienti…</p>}

      {!loading && list.length === 0 && (
        <p className="rounded border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          Nessun paziente attivo per questo PMA. Creane uno autopresentato o attendi un invio dalla
          centrale.
        </p>
      )}

      {!loading && list.length > 0 && (
        <div className="grid min-h-0 min-w-0 flex-1 gap-4 lg:grid-cols-[minmax(260px,320px)_1fr]">
          <aside className="flex flex-col gap-4 overflow-y-auto rounded-lg border border-amber-200 bg-amber-50/30 p-3">
            <section>
              <h2 className="mb-2 text-xs font-bold uppercase text-amber-900">
                In arrivo ({inArrivo.length})
              </h2>
              {inArrivo.length === 0 ? (
                <p className="text-xs text-slate-500">Nessuno in arrivo.</p>
              ) : (
                <ul className="space-y-2">
                  {inArrivo.map((p) => (
                    <li key={p._docId}>
                      <PmaPatientReadonlyCard
                        paziente={p}
                        footer={
                          <button
                            type="button"
                            className={`${btnPrimary} mt-2 w-full text-xs`}
                            disabled={busyId === p._docId}
                            onClick={() => void handlePrendiInCarico(p._docId)}
                          >
                            {busyId === p._docId ? '…' : 'Prendi in carico'}
                          </button>
                        }
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="mb-2 text-xs font-bold uppercase text-orange-900">
                In attesa ({inAttesa.length})
              </h2>
              {inAttesa.length === 0 ? (
                <p className="text-xs text-slate-500">Nessuno in attesa.</p>
              ) : (
                <ul className="space-y-2">
                  {inAttesa.map((p) => (
                    <li key={p._docId}>
                      <PmaPatientReadonlyCard
                        paziente={p}
                        footer={
                          <button
                            type="button"
                            className={`${btnPrimary} mt-2 w-full text-xs`}
                            disabled={busyId === p._docId}
                            onClick={() => void handlePrendiInCarico(p._docId)}
                          >
                            {busyId === p._docId ? '…' : 'Prendi in carico'}
                          </button>
                        }
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>

          <main className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-300 bg-slate-50 p-3">
            <h2 className="mb-3 text-sm font-bold uppercase text-slate-800">
              In carico ({inCarico.length})
            </h2>
            {inCarico.length === 0 ? (
              <p className="text-sm text-slate-500">
                Nessun paziente in carico. Prendi in carico un paziente dalla colonna di sinistra
                oppure attendi l&apos;aggiornamento ARRIVATO H dalla centrale.
              </p>
            ) : (
              <ul className="grid gap-3 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3">
                {inCarico.map((p) => (
                  <li key={p._docId}>
                    <PmaInCaricoCard
                      paziente={p}
                      evento={eventoFor(p)}
                      onOpen={() => navigate(openPazientePath(pma.id, p._docId))}
                    />
                  </li>
                ))}
              </ul>
            )}
          </main>
        </div>
      )}

      {!loading && dimessi.length > 0 && (
        <section className="mt-6 rounded-lg border border-slate-300 bg-white">
          <button
            type="button"
            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-bold uppercase text-slate-700 hover:bg-slate-50"
            onClick={() => setShowDimessi((v) => !v)}
          >
            <span>Dimessi ({dimessi.length})</span>
            <span className="text-xs font-normal normal-case text-slate-500">
              {showDimessi ? 'Nascondi' : 'Mostra scheda in sola visione'}
            </span>
          </button>
          {showDimessi && (
            <ul className="grid gap-2 border-t border-slate-200 p-3 sm:grid-cols-2 lg:grid-cols-3">
              {dimessi.map((p) => (
                <li key={p._docId}>
                  <PmaPatientReadonlyCard
                    paziente={p}
                    footer={
                      <button
                        type="button"
                        className={`${btnSecondary} mt-2 w-full text-xs`}
                        onClick={() => navigate(openPazientePath(pma.id, p._docId))}
                      >
                        Apri scheda
                      </button>
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
