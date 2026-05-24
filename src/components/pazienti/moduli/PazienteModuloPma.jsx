import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useImpostazioni } from '../../../hooks/useImpostazioni';
import { usePazienteDocument } from '../../../hooks/usePazienteDocument';
import { findPmaById, isPazienteOriginePma, STATO_PZ_PMA, statoPzPmaLabel } from '../../../lib/pmaModule';
import { chiusuraCentraleLabel, isChiusoCentrale, statoCentraleLabel } from '../../../lib/pazienteStati';
import { isVistaCentrale, isVistaPma, moduliSchedaPaziente, VISTA_SCHEDA } from '../../../lib/pazienteSchedaModuli';
import { canEditPmaScheda, crossDocToPazienteView, isPmaSchedaReadonly } from '../../../pma/adapters/crossPazienteAdapter';
import { patchPazientePmaGranular } from '../../../pma/lib/pazientePmaPatch';
import { usePmaClinicaListe } from '../../../pma/hooks/usePmaClinicaListe';
import { PazienteAnagraficaPmaTab } from '../PazienteAnagraficaPmaTab';
import { DettaglioPaziente } from '../../../pma/components/scheda-paziente/DettaglioPaziente';
import { CartellaClinicaSection } from '../../../pma/components/scheda-paziente/CartellaClinicaSection';
import { DimissioneSection } from '../../../pma/components/scheda-paziente/DimissioneSection';
import { pmaShellTabsFor } from '../../../pma/components/scheda-paziente/schedaPazienteTabs';
import { PmaFieldPresenceProvider } from '../../../pma/context/PmaFieldPresenceContext';
import { PazienteModuloCentrale } from './PazienteModuloCentrale';
import { PmaPazientePanel } from '../PmaPazientePanel';
import { normalizePmaRank } from '../../../lib/userAccess';
import { findEvento } from '../../../lib/eventoLinks';

/**
 * Modulo PMA unificato (4 tab).
 * @param {string} vistaScheda - `VISTA_SCHEDA.CENTRALE` | `VISTA_SCHEDA.PMA`
 * @param {string} [contesto] - alias deprecato di `vistaScheda`
 */
export function PazienteModuloPma({
  patientDocId,
  pmaId,
  eventi = [],
  missioniEvento = [],
  evento = null,
  vistaScheda,
  contesto,
  onDimesso,
  defaultTab = 'cartella',
  initialTab,
  anagraficaPanel = null,
  datiCentralePanel = null,
}) {
  const resolvedVista = vistaScheda ?? contesto ?? VISTA_SCHEDA.CENTRALE;
  const vistaPma = isVistaPma(resolvedVista);
  const vistaCentrale = isVistaCentrale(resolvedVista);

  const { profile, user } = useAuth();
  const { impostazioni } = useImpostazioni();
  const liste = usePmaClinicaListe();
  const { rawDoc, loading, manifestationId } = usePazienteDocument(patientDocId);
  const resolvedDefault = initialTab ?? defaultTab;
  const [activeTab, setActiveTab] = useState(resolvedDefault);
  const [saveError, setSaveError] = useState(null);
  const [tipoEv, setTipoEv] = useState('');
  const [dettaglioEv, setDettaglioEv] = useState('');

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  const pma = useMemo(() => findPmaById(impostazioni, pmaId), [impostazioni, pmaId]);
  const eventoResolved = useMemo(
    () =>
      evento ??
      (rawDoc ? findEvento(eventi, rawDoc.eventoIdUnivoco ?? rawDoc.eventoCorrelato) : null),
    [rawDoc, eventi, evento],
  );
  const moduli = useMemo(
    () => (rawDoc ? moduliSchedaPaziente(rawDoc) : null),
    [rawDoc],
  );

  const p = useMemo(() => {
    if (!rawDoc) return null;
    return crossDocToPazienteView(rawDoc, manifestationId, pmaId);
  }, [rawDoc, manifestationId, pmaId]);

  const schedaReadonly = rawDoc ? isPmaSchedaReadonly(rawDoc) : false;
  const canEditPma =
    vistaPma && p && rawDoc ? canEditPmaScheda(p, rawDoc) && !schedaReadonly : false;
  const isAutopresentato = rawDoc ? isPazienteOriginePma(rawDoc) : false;
  const shellTabs = useMemo(() => pmaShellTabsFor(isAutopresentato), [isAutopresentato]);
  const canEditStatoPma = vistaPma && isAutopresentato && !schedaReadonly;
  const canEditAnagraficaAutopresentato = vistaPma && isAutopresentato && !schedaReadonly;

  const pmaUser = user
    ? {
        uid: user.uid,
        nome: profile?.nome ?? user.displayName ?? '',
        nomeUtente: profile?.nomeUtente ?? '',
        rank: normalizePmaRank(profile?.pmaRank),
      }
    : null;

  const write = useCallback(
    async (patch) => {
      if (!canEditPma || !manifestationId || !patientDocId) return;
      setSaveError(null);
      try {
        await patchPazientePmaGranular(manifestationId, patientDocId, patch);
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Errore salvataggio');
        throw err;
      }
    },
    [canEditPma, manifestationId, patientDocId],
  );

  useEffect(() => {
    if (!p) return;
    setTipoEv(p.tipo_evento || eventoResolved?.tipoEvento || '');
    setDettaglioEv(p.dettaglio_evento || eventoResolved?.dettaglioEvento || '');
  }, [p, eventoResolved?.tipoEvento, eventoResolved?.dettaglioEvento]);

  useEffect(() => {
    if (isAutopresentato && activeTab === 'dati_centrale') {
      setActiveTab('anagrafica');
    }
  }, [isAutopresentato, activeTab]);

  if (loading) {
    return <p className="text-sm text-slate-500">Caricamento modulo PMA…</p>;
  }

  if (!rawDoc || !p) {
    return (
      <p className="text-sm text-amber-800">Modulo PMA non disponibile (dati paziente assenti).</p>
    );
  }

  const manifestazioneNome = impostazioni?.nomeManifestazione ?? 'Manifestazione';
  const pmaNome = pma?.nome ?? rawDoc.ospedaleDestinazione ?? 'PMA';

  const haDettaglioEvento = Boolean(
    moduli?.eventoCentrale ||
      moduli?.pmaEvento ||
      isAutopresentato ||
      eventoResolved?.idEvento ||
      tipoEv ||
      dettaglioEv ||
      eventoResolved?.tipoEvento ||
      eventoResolved?.dettaglioEvento,
  );

  const flushEvento = async (tipo, dettaglio) => {
    const patch = {
      tipo_evento: tipo.trim(),
      dettaglio_evento: dettaglio.trim(),
    };
    if (canEditPma) {
      await write(patch);
      return;
    }
    if (canEditAnagraficaAutopresentato && manifestationId && patientDocId) {
      await patchPazientePmaGranular(manifestationId, patientDocId, patch);
    }
  };

  const defaultAnagrafica = (
    <PazienteAnagraficaPmaTab
      rawDoc={rawDoc}
      impostazioni={impostazioni}
      manifestationId={manifestationId}
      patientDocId={patientDocId}
      readOnly={!isAutopresentato}
      canEdit={isAutopresentato ? canEditAnagraficaAutopresentato : canEditPma}
      isAutopresentato={isAutopresentato}
      canEditStatoPma={canEditStatoPma}
      eventoResolved={eventoResolved}
      tipoEv={tipoEv}
      dettaglioEv={dettaglioEv}
      onTipoEvChange={setTipoEv}
      onDettaglioEvChange={setDettaglioEv}
      onFlushEvento={flushEvento}
      showEventoDettaglio={haDettaglioEvento}
      eventoEditable={isAutopresentato && canEditAnagraficaAutopresentato}
    />
  );

  const defaultDatiCentrale = moduli?.eventoCentrale ? (
    <PazienteModuloCentrale
      manifestationId={manifestationId}
      patientDocId={patientDocId}
      paziente={rawDoc}
      evento={eventoResolved}
      missioniEvento={missioniEvento}
    />
  ) : (
    <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
      Paziente autopresentato al PMA: nessun dato operativo da centrale (evento, missione, esito
      trasporto, valutazioni MSB/MSA).
    </p>
  );

  const shellPanels = {
    anagrafica: anagraficaPanel ?? defaultAnagrafica,
    dati_centrale: datiCentralePanel ?? defaultDatiCentrale,
    cartella: (
      <CartellaClinicaSection
        pazienteId={patientDocId}
        p={p}
        canEdit={canEditPma}
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
        canEditDimissioneTab={canEditPma}
        canEditScheda={canEditPma}
        write={write}
        onDimesso={vistaPma ? onDimesso : undefined}
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

  const inner = (
    <div className={vistaPma ? 'flex min-h-0 flex-1 flex-col' : 'space-y-4'}>
      {vistaCentrale && (
        <p className="text-xs font-bold uppercase text-slate-600">Modulo PMA</p>
      )}

      <PmaPazientePanel paziente={rawDoc} pmaNome={pmaNome} compact={vistaPma} />

      {schedaReadonly && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Paziente dimesso — scheda in sola lettura.
        </p>
      )}

      {vistaCentrale && !canEditPma && rawDoc.statoPzPma !== STATO_PZ_PMA.IN_CARICO && (
        <p className="text-xs text-slate-600">
          La cartella clinica PMA è modificabile dal personale in tenda quando il paziente è{' '}
          <strong>in carico</strong>.
        </p>
      )}

      <div
        className={
          vistaPma
            ? 'flex min-h-0 flex-1 flex-col overflow-hidden'
            : 'overflow-hidden rounded-lg border border-slate-300 bg-white'
        }
      >
        {saveError && (
          <p className="border-b border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
            {saveError}
          </p>
        )}
        <DettaglioPaziente
          p={p}
          tabs={shellTabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          saveError={null}
          panels={shellPanels}
          fillHeight={vistaPma}
          variant="cross"
          statoPmaLabel={statoPzPmaLabel(rawDoc.statoPzPma)}
          statoCentraleLabel={
            isPazienteOriginePma(rawDoc) ? null : statoCentraleLabel(rawDoc)
          }
          chiusoCentrale={isChiusoCentrale(rawDoc)}
        />
      </div>
    </div>
  );

  if (canEditPma) {
    return (
      <PmaFieldPresenceProvider manifestationId={manifestationId} pazienteDocId={patientDocId}>
        {inner}
      </PmaFieldPresenceProvider>
    );
  }

  return inner;
}
