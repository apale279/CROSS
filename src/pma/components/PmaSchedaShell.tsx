import { useCallback, useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { useImpostazioni } from '../../hooks/useImpostazioni';
import { useManifestazioneId } from '../../context/ManifestazioneContext';
import { pazientiPath } from '../../lib/firestorePaths';
import { patchPazientePmaGranular } from '../lib/pazientePmaPatch';
import { STATO_PZ_PMA } from '../../lib/pmaModule';
import { db } from '../cross/firebase';
import {
  crossDocToPazienteView,
  canEditPmaScheda,
  canEditPmaAnagrafica,
} from '../adapters/crossPazienteAdapter';
import { usePmaClinicaListe } from '../hooks/usePmaClinicaListe';
import type { UserProfile } from '../types/userProfile';
import { DettaglioPaziente } from './scheda-paziente/DettaglioPaziente';
import { CartellaClinicaSection } from './scheda-paziente/CartellaClinicaSection';
import { DimissioneSection } from './scheda-paziente/DimissioneSection';
import { PmaAnagraficaSection } from './PmaAnagraficaSection';
import { PmaFieldPresenceProvider } from '../context/PmaFieldPresenceContext';
import { normalizePmaRank } from '../../lib/userAccess';

type TabId = 'anagrafica' | 'cartella' | 'dimissione';

const TABS: { id: TabId; label: string }[] = [
  { id: 'anagrafica', label: 'Anagrafica' },
  { id: 'cartella', label: 'Cartella clinica' },
  { id: 'dimissione', label: 'Dimissione' },
];

type Props = {
  pazienteDocId: string;
  pmaId: string;
  pmaNome: string;
  onClose: () => void;
};

export function PmaSchedaShell({ pazienteDocId, pmaId, pmaNome, onClose }: Props) {
  const manifestationId = useManifestazioneId();
  const { profile, user } = useAuth();
  const { impostazioni } = useImpostazioni();
  const liste = usePmaClinicaListe();
  const [rawDoc, setRawDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('cartella');
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    if (!manifestationId || !pazienteDocId) return undefined;
    const ref = doc(db, ...pazientiPath(manifestationId), pazienteDocId);
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setRawDoc(null);
      } else {
        setRawDoc({ _docId: snap.id, ...snap.data() });
      }
      setLoading(false);
    });
    return () => unsub();
  }, [manifestationId, pazienteDocId]);

  const p = useMemo(() => {
    if (!rawDoc) return null;
    return crossDocToPazienteView(rawDoc, manifestationId, pmaId);
  }, [rawDoc, manifestationId, pmaId]);

  const canEdit = p ? canEditPmaScheda(p) : false;
  const centraleReadonly = rawDoc ? !canEditPmaAnagrafica(rawDoc) : true;

  const pmaUser: UserProfile | null = user
    ? {
        uid: user.uid,
        nome: profile?.nome ?? user.displayName ?? '',
        nomeUtente: profile?.nomeUtente ?? '',
        rank: normalizePmaRank(profile?.pmaRank),
      }
    : null;

  const write = useCallback(
    async (patch: Record<string, unknown>) => {
      if (!manifestationId || !pazienteDocId) return;
      setSaveError(null);
      try {
        await patchPazientePmaGranular(manifestationId, pazienteDocId, patch);
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Errore salvataggio');
        throw err;
      }
    },
    [manifestationId, pazienteDocId],
  );

  if (loading) {
    return <p className="p-8 text-center text-sm text-slate-500">Caricamento scheda…</p>;
  }

  if (!p || !rawDoc) {
    return (
      <div className="p-8 text-center text-sm text-slate-600">
        Paziente non trovato.
        <button type="button" className="ml-2 text-violet-700 underline" onClick={onClose}>
          Torna al PMA
        </button>
      </div>
    );
  }

  if (p.stato !== 'in_carico' && rawDoc.statoPzPma !== STATO_PZ_PMA.IN_CARICO) {
    return (
      <div className="p-8 text-center text-sm text-amber-900">
        La pagina PMA è disponibile solo per pazienti <strong>in carico</strong>.
        <button type="button" className="ml-2 text-violet-700 underline" onClick={onClose}>
          Torna al PMA
        </button>
      </div>
    );
  }

  const manifestazioneNome = impostazioni?.nomeManifestazione ?? 'Manifestazione';

  const panels = {
    anagrafica: (
      <PmaAnagraficaSection
        p={p}
        canEdit={canEdit}
        centraleReadonly={centraleReadonly}
        write={write}
      />
    ),
    cartella: (
      <CartellaClinicaSection
        pazienteId={pazienteDocId}
        p={p}
        canEdit={canEdit}
        write={write}
        user={pmaUser}
        embedded
      />
    ),
    dimissione: (
      <DimissioneSection
        p={p}
        user={pmaUser}
        isMedico
        canEditDimissioneTab={canEdit}
        canEditScheda={canEdit}
        write={write}
        reportManifestazioneNome={manifestazioneNome}
        reportPmaNome={pmaNome}
        consensoGenericoCure={liste.consensoGenericoCure}
        consensoPrivacy={liste.consensoPrivacy}
        rifiutoInvioPs={liste.rifiutoInvioPs}
        presetDimissione={liste.presetDimissione}
        prestazioniManifestazioneLista={liste.prestazioni}
      />
    ),
  };

  return (
    <PmaFieldPresenceProvider manifestationId={manifestationId} pazienteDocId={pazienteDocId}>
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-violet-200 bg-violet-950 px-4 py-3 text-white">
        <div>
          <button
            type="button"
            className="text-xs font-medium text-violet-200 hover:text-white"
            onClick={onClose}
          >
            ← {pmaNome}
          </button>
          <h1 className="text-lg font-bold">{p.id_paziente_visibile}</h1>
        </div>
        <span className="rounded bg-violet-800 px-2 py-1 text-xs font-bold uppercase">PMA</span>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <DettaglioPaziente
          p={p}
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          saveError={
            saveError ? (
              <p className="mb-2 rounded bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
                {saveError}
              </p>
            ) : null
          }
          panels={panels}
        />
      </div>
    </div>
    </PmaFieldPresenceProvider>
  );
}
