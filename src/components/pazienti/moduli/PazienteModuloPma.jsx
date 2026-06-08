import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useEventoScheda } from '../../../context/EventoSchedaContext';
import { useImpostazioni } from '../../../hooks/useImpostazioni';
import { usePazienteDocument } from '../../../hooks/usePazienteDocument';
import {
  findPmaById,
  isPazienteOriginePma,
  normalizeStatoPzPma,
  pazienteHaDestinazionePma,
  pazientePmaChiuso,
  canConvertToCodiceMinore,
  STATO_PZ_PMA,
  statoPzPmaLabel,
} from '../../../lib/pmaModule';
import { chiusuraCentraleLabel, isChiusoCentrale, statoCentraleLabel } from '../../../lib/pazienteStati';
import { invioPsSoreuPatchForScheda, invioPsSoreuFieldsFromScheda } from '../../../lib/invioPsSoreu';

const SOREU_PARTIAL_TO_SCHEDA_PATH = {
  soreuOraMissione: 'invio_ps_soreu_ora_missione',
  soreuNumeroMissione: 'invio_ps_soreu_numero_missione',
  soreuAccompagnato: 'invio_ps_soreu_accompagnato',
  soreuCodice: 'invio_ps_soreu_codice',
};

function soreuSchedaPathValuesEqual(a, b) {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (typeof a?.toMillis === 'function' && typeof b?.toMillis === 'function') {
    return a.toMillis() === b.toMillis();
  }
  return JSON.stringify(a) === JSON.stringify(b);
}
import {
  isSchedaInSolaVisione,
  isSchedaModificaForzata,
  isSchedaModificabile,
} from '../../../lib/schedaSolaVisione';
import { patchPaziente } from '../../../services/pazientiService';
import { convertPazienteToCodiceMinore } from '../../../services/pmaCodiceMinoreService';
import { InvioPsSoreuTrasportoBlock } from '../InvioPsSoreuTrasportoBlock';
import { SchedaUnlockBar } from '../SchedaUnlockBar';
import { isVistaCentrale, isVistaPma, moduliSchedaPaziente, VISTA_SCHEDA } from '../../../lib/pazienteSchedaModuli';
import { canEditPmaScheda, crossDocToPazienteView, isPmaSchedaReadonly } from '../../../pma/adapters/crossPazienteAdapter';
import { patchPazientePmaGranular } from '../../../pma/lib/pazientePmaPatch';
import { usePmaClinicaListe } from '../../../pma/hooks/usePmaClinicaListe';
import { PazienteAnagraficaPmaTab } from '../PazienteAnagraficaPmaTab';
import { DettaglioPaziente } from '../../../pma/components/scheda-paziente/DettaglioPaziente';
import { CartellaClinicaSection } from '../../../pma/components/scheda-paziente/CartellaClinicaSection';
import { TriageSection } from '../../../pma/components/scheda-paziente/TriageSection';
import { DimissioneSection } from '../../../pma/components/scheda-paziente/DimissioneSection';
import {
  filterPmaShellTabsByRank,
  pmaShellTabsFor,
  PMA_CLINICAL_SHELL_TABS,
} from '../../../pma/components/scheda-paziente/schedaPazienteTabs';
import { staffSoftRefFromUser } from '../../../pma/lib/staffSoftRef';
import { schedaTabDimissioneAllows } from '../../../pma/lib/rankMatrix';
import { PmaFieldPresenceProvider } from '../../../pma/context/PmaFieldPresenceContext';
import { PazienteModuloCentrale } from './PazienteModuloCentrale';
import { PmaPazientePanel } from '../PmaPazientePanel';
import { effectivePmaUserRank, isPmaMedicoAccount, normalizePmaRank } from '../../../lib/userAccess';
import { IS_SUPERADMIN } from '../../../constants';
import { findEvento } from '../../../lib/eventoLinks';
import { COLLECTIONS } from '../../../lib/firestorePaths';
import { useManifestazioneCollection } from '../../../hooks/useManifestazioneCollection';
import { DiarioImportantTicker } from '../../diario/DiarioImportantTicker';
import { usePmaFieldUx } from '../../../pma/hooks/usePmaFieldUx';

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
  defaultTab = 'cartella',
  initialTab,
  anagraficaPanel = null,
  datiCentralePanel = null,
  /** Solo cartella/dimissione (es. sezione PMA collassabile in vista centrale). */
  clinicalOnly = false,
  hidePmaPanel = false,
  /** Barra sblocco mostrata dal genitore (es. tab scheda in Pazienti). */
  hideSchedaUnlockBar = false,
}) {
  const resolvedVista = vistaScheda ?? contesto ?? VISTA_SCHEDA.CENTRALE;
  const vistaPma = isVistaPma(resolvedVista);
  const vistaCentrale = isVistaCentrale(resolvedVista);
  const mobileVistaPma = usePmaFieldUx() && vistaPma;
  const navigate = useNavigate();
  const { openEventoScheda } = useEventoScheda();

  const { profile, user } = useAuth();
  const { impostazioni } = useImpostazioni();
  const { data: noteDiario, loading: loadingDiario } = useManifestazioneCollection(
    COLLECTIONS.note_diario,
  );
  const liste = usePmaClinicaListe();
  const { rawDoc, loading, manifestationId } = usePazienteDocument(patientDocId);
  const resolvedDefault = initialTab ?? defaultTab;
  const [activeTab, setActiveTab] = useState(resolvedDefault);
  const [saveError, setSaveError] = useState(null);
  const [tipoEv, setTipoEv] = useState('');
  const [dettaglioEv, setDettaglioEv] = useState('');
  const [rendiCodiceMinoreBusy, setRendiCodiceMinoreBusy] = useState(false);

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

  const operativeRank =
    effectivePmaUserRank(profile, IS_SUPERADMIN) ?? normalizePmaRank(profile?.pmaRank);

  const pmaUser = user
    ? {
        uid: user.uid,
        nome: profile?.nome ?? user.displayName ?? '',
        nomeUtente: profile?.nomeUtente ?? '',
        rank: operativeRank,
        firma_medico_base64: profile?.firma_medico_base64 ?? null,
        firma_medico_svg: profile?.firma_medico_svg ?? null,
        firmaUrl: profile?.firmaUrl ?? null,
        note_personali: profile?.note_personali ?? null,
      }
    : null;
  const schedaReadonly = rawDoc ? isPmaSchedaReadonly(rawDoc) : false;
  const schedaEditAllowed = p && rawDoc ? canEditPmaScheda(p, rawDoc) : false;
  const canEditPmaCentraleInCarico =
    !vistaPma &&
    rawDoc?.statoPzPma === STATO_PZ_PMA.IN_CARICO &&
    pmaUser &&
    schedaTabDimissioneAllows(pmaUser.rank, 'UPDATE');
  const canEditPma =
    schedaEditAllowed &&
    (vistaPma || rawDoc?.schedaModificaForzata === true || canEditPmaCentraleInCarico);
  const isAutopresentato = rawDoc ? isPazienteOriginePma(rawDoc) : false;
  const hasPmaScheda = Boolean(rawDoc?.pmaScheda);
  const shellTabs = useMemo(() => {
    const base = clinicalOnly
      ? PMA_CLINICAL_SHELL_TABS
      : pmaShellTabsFor(isAutopresentato, { hasPmaScheda });
    if (!operativeRank) return base;
    return filterPmaShellTabsByRank(base, operativeRank);
  }, [clinicalOnly, isAutopresentato, operativeRank, hasPmaScheda]);
  const canEditStatoPma = vistaPma && isAutopresentato && !schedaReadonly;
  const canEditAnagraficaAutopresentato = vistaPma && isAutopresentato && !schedaReadonly;
  const canEditColore = vistaPma && rawDoc && !pazientePmaChiuso(rawDoc);
  const canConvertCm = Boolean(rawDoc && canConvertToCodiceMinore(rawDoc));
  const statoPmaNorm = normalizeStatoPzPma(rawDoc?.statoPzPma);
  const showRendiCodiceMinoreInAnagrafica =
    vistaPma && canConvertCm && statoPmaNorm === STATO_PZ_PMA.IN_CARICO;

  const handleRendiCodiceMinore = useCallback(async () => {
    if (!rawDoc || !manifestationId || !patientDocId || !pmaId) return;
    if (
      !window.confirm(
        'Trasformare questo paziente in codice minore (fast track astanteria)? I dati centrale e la scheda clinica restano archiviati.',
      )
    ) {
      return;
    }
    setRendiCodiceMinoreBusy(true);
    try {
      await convertPazienteToCodiceMinore(manifestationId, patientDocId, pmaId, rawDoc);
    } catch (err) {
      alert(err?.message ?? 'Errore conversione');
    } finally {
      setRendiCodiceMinoreBusy(false);
    }
  }, [rawDoc, manifestationId, patientDocId, pmaId]);

  const write = useCallback(
    async (patch) => {
      if (!canEditPma || !manifestationId || !patientDocId) return;
      setSaveError(null);
      try {
        await patchPazientePmaGranular(manifestationId, patientDocId, patch, {
          operatorUid: user?.uid ?? null,
        });
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Errore salvataggio');
        throw err;
      }
    },
    [canEditPma, manifestationId, patientDocId, user?.uid],
  );

  useEffect(() => {
    if (!p) return;
    setTipoEv(p.tipo_evento || eventoResolved?.tipoEvento || '');
    setDettaglioEv(p.dettaglio_evento || eventoResolved?.dettaglioEvento || '');
  }, [p?.id, eventoResolved?.tipoEvento, eventoResolved?.dettaglioEvento]);

  useEffect(() => {
    if (clinicalOnly && activeTab !== 'cartella' && activeTab !== 'dimissione') {
      setActiveTab('cartella');
    }
  }, [clinicalOnly, activeTab]);

  useEffect(() => {
    if (clinicalOnly) return;
    if (shellTabs.some((t) => t.id === activeTab)) return;
    setActiveTab(shellTabs[0]?.id ?? 'cartella');
  }, [clinicalOnly, shellTabs, activeTab]);

  useEffect(() => {
    if (!pmaUser || !rawDoc || !manifestationId || !patientDocId) return;
    if (rawDoc.statoPzPma !== STATO_PZ_PMA.IN_CARICO) return;
    const rank = profile?.pmaRank ? normalizePmaRank(profile.pmaRank) : null;
    if (rank !== 'Medico' && rank !== 'Infermiere') return;
    const ref = staffSoftRefFromUser(pmaUser);
    if (!ref) return;
    const patch = {};
    if (rank === 'Infermiere' && !String(p?.infermiere_rif ?? '').trim()) {
      patch.infermiere_rif = ref;
    }
    if (rank === 'Medico' && !String(p?.medico_rif ?? '').trim()) {
      patch.medico_rif = ref;
    }
    if (Object.keys(patch).length === 0) return;
    void patchPazientePmaGranular(manifestationId, patientDocId, patch, {
      operatorUid: user?.uid ?? null,
    }).catch((err) => {
      console.warn('Aggiornamento riferimento staff PMA non riuscito:', err);
    });
  }, [
    pmaUser,
    profile?.pmaRank,
    rawDoc?.statoPzPma,
    p?.infermiere_rif,
    p?.medico_rif,
    manifestationId,
    patientDocId,
  ]);

  if (loading) {
    return <p className="text-sm text-slate-500">Caricamento modulo PMA…</p>;
  }

  if (!patientDocId) {
    return (
      <p className="text-sm text-amber-800">
        Modulo PMA non disponibile: salva prima il paziente o apri una scheda esistente.
      </p>
    );
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
      await patchPazientePmaGranular(manifestationId, patientDocId, patch, {
        operatorUid: user?.uid ?? null,
      });
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
      canEditColore={canEditColore}
      showRendiCodiceMinore={showRendiCodiceMinoreInAnagrafica}
      rendiCodiceMinoreAtTop
      onRendiCodiceMinore={handleRendiCodiceMinore}
      rendiCodiceMinoreBusy={rendiCodiceMinoreBusy}
      pmaId={pmaId}
      vistaPma={vistaPma}
    />
  );

  const messaggioAutopresentatoDatiCentrale = (
    <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
      Paziente autopresentato al PMA: nessun dato operativo da centrale (evento, missione, esito
      trasporto, valutazioni MSB/MSA).
    </p>
  );

  const defaultDatiCentrale = isAutopresentato ? (
    messaggioAutopresentatoDatiCentrale
  ) : moduli?.eventoCentrale ? (
    <PazienteModuloCentrale
      manifestationId={manifestationId}
      patientDocId={patientDocId}
      paziente={rawDoc}
      evento={eventoResolved}
      missioniEvento={missioniEvento}
    />
  ) : (
    messaggioAutopresentatoDatiCentrale
  );

  const canEditDimissioneTab = Boolean(
    canEditPma && pmaUser && schedaTabDimissioneAllows(pmaUser.rank, 'UPDATE'),
  );
  const schedaModificabile = rawDoc ? isSchedaModificabile(rawDoc) : false;

  const pmaIpadFirma =
    manifestationId && pmaId && patientDocId && user?.uid
      ? {
          manifestationId,
          pmaId,
          pazienteDocId: patientDocId,
          operatorUid: user.uid,
          operatorNome: profile?.nome ?? user.displayName ?? '',
        }
      : null;

  const shellPanels = {
    anagrafica: anagraficaPanel ?? defaultAnagrafica,
    dati_centrale: datiCentralePanel ?? defaultDatiCentrale,
    triage: hasPmaScheda ? (
      <TriageSection
        pazienteId={patientDocId}
        p={p}
        canEdit={canEditPma}
        write={write}
        user={pmaUser}
        embedded
      />
    ) : null,
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
      <>
        <DimissioneSection
          p={p}
          user={pmaUser}
          isMedico={isPmaMedicoAccount(profile) || pmaUser?.rank === 'Medico'}
          canEditDimissioneTab={canEditDimissioneTab}
          canEditScheda={canEditPma}
          write={write}
          reportManifestazioneNome={manifestazioneNome}
          reportPmaNome={pmaNome}
          consensoGenericoCure={liste.consensoGenericoCure}
          consensoPrivacy={liste.consensoPrivacy}
          rifiutoInvioPs={liste.rifiutoInvioPs}
          presetDimissione={liste.presetDimissione}
          prestazioniManifestazioneLista={liste.prestazioni}
          pmaIpadFirma={pmaIpadFirma}
          ospedaleDestinazioneCentrale={rawDoc?.ospedaleDestinazione ?? null}
        />
        <InvioPsSoreuTrasportoBlock
          manifestationId={manifestationId}
          paziente={rawDoc}
          pma={pma}
          soreuReadOnly={!schedaModificabile}
          onWriteSoreu={async (partial) => {
            if (!schedaModificabile || !manifestationId || !patientDocId) return;
            if (!partial || Object.keys(partial).length === 0) return;

            const current = invioPsSoreuFieldsFromScheda(rawDoc.pmaScheda ?? {});
            const currentPaths = invioPsSoreuPatchForScheda(current);
            const nextPaths = invioPsSoreuPatchForScheda({ ...current, ...partial });
            const patch = {};

            for (const [key, schedaPath] of Object.entries(SOREU_PARTIAL_TO_SCHEDA_PATH)) {
              if (!(key in partial)) continue;
              if (!soreuSchedaPathValuesEqual(nextPaths[schedaPath], currentPaths[schedaPath])) {
                patch[schedaPath] = nextPaths[schedaPath];
              }
            }

            if ('invio_ps_ospedale' in partial) {
              const prev = String(rawDoc.pmaScheda?.invio_ps_ospedale ?? '').trim();
              const next = String(partial.invio_ps_ospedale ?? '').trim();
              if (next !== prev) patch.invio_ps_ospedale = next;
            }

            if (Object.keys(patch).length === 0) return;

            await patchPazientePmaGranular(manifestationId, patientDocId, patch, {
              operatorUid: user?.uid ?? null,
            });
          }}
          onOpenEvento={(ev) => {
            const full = eventi.find((e) => e._docId === ev._docId) ?? ev;
            openEventoScheda(full);
          }}
          onOpenMissione={(mis) => {
            navigate(`/missioni?open=${encodeURIComponent(mis._docId)}`);
          }}
          onOpenPazienteRiferimento={(p) => {
            if (vistaPma) {
              setActiveTab('dimissione');
              return;
            }
            navigate(`/pazienti?open=${encodeURIComponent(p._docId ?? patientDocId)}`);
          }}
        />
      </>
    ),
  };

  const mobileUnlockVisible =
    mobileVistaPma &&
    !hideSchedaUnlockBar &&
    rawDoc &&
    (isSchedaInSolaVisione(rawDoc) || isSchedaModificaForzata(rawDoc));
  const mobileDiarioVisible =
    mobileVistaPma && (noteDiario?.some((n) => n.importante === true) ?? false);
  const mobileAlertSlot =
    mobileUnlockVisible || mobileDiarioVisible ? (
      <>
        {mobileDiarioVisible ? (
          <DiarioImportantTicker
            note={noteDiario}
            loading={loadingDiario}
            hideWhenEmpty
            onOpenNota={() => navigate('/diario')}
          />
        ) : null}
        {mobileUnlockVisible ? (
          <div className="mx-3 flex justify-end">
            <SchedaUnlockBar
              compact
              paziente={rawDoc}
              onToggleModifica={async (forced) => {
                if (!manifestationId || !patientDocId) return;
                await patchPaziente(manifestationId, patientDocId, {
                  schedaModificaForzata: forced,
                });
              }}
            />
          </div>
        ) : null}
      </>
    ) : null;

  const inner = (
    <div
      className={
        vistaPma ? 'pma-viewport flex min-h-0 min-w-0 flex-1 flex-col overflow-x-clip' : 'space-y-4'
      }
    >
      {vistaCentrale && !clinicalOnly && (
        <p className="text-xs font-bold uppercase text-slate-600">Modulo PMA</p>
      )}

      {vistaPma && !mobileVistaPma ? (
        <DiarioImportantTicker
          note={noteDiario}
          loading={loadingDiario}
          onOpenNota={() => navigate('/diario')}
        />
      ) : null}

      {!hidePmaPanel && (
        <PmaPazientePanel paziente={rawDoc} pmaNome={pmaNome} compact={vistaPma} />
      )}

      {!mobileVistaPma ? (
        <div
          className={
            hideSchedaUnlockBar
              ? 'grid shrink-0 gap-2 text-sm sm:grid-cols-2'
              : 'grid shrink-0 grid-cols-[1fr_1fr_auto] items-end gap-x-3 px-3 text-sm sm:gap-x-4 sm:px-4'
          }
        >
          <div className="min-w-0 text-left">
            <p className="text-xs font-medium text-slate-500">Medico di riferimento</p>
            <p className="truncate font-semibold text-slate-800">{p.medico_rif?.trim() || '—'}</p>
          </div>
          <div className={`min-w-0 ${hideSchedaUnlockBar ? '' : 'text-center'}`}>
            <p className="text-xs font-medium text-slate-500">Infermiere di riferimento</p>
            <p className="truncate font-semibold text-slate-800">{p.infermiere_rif?.trim() || '—'}</p>
          </div>
          {!hideSchedaUnlockBar ? (
            <div className="flex shrink-0 items-end justify-end pb-px">
              <SchedaUnlockBar
                paziente={rawDoc}
                onToggleModifica={async (forced) => {
                  if (!manifestationId || !patientDocId) return;
                  await patchPaziente(manifestationId, patientDocId, {
                    schedaModificaForzata: forced,
                  });
                }}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {vistaCentrale && !canEditPma && rawDoc.statoPzPma === STATO_PZ_PMA.IN_CARICO && (
        <p className="text-xs text-slate-600">
          La cartella clinica PMA è modificabile dal personale in tenda mentre il paziente è{' '}
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
          mobileFocused={mobileVistaPma}
          statoPmaLabel={statoPzPmaLabel(rawDoc.statoPzPma)}
          statoCentraleLabel={
            isPazienteOriginePma(rawDoc) ? null : statoCentraleLabel(rawDoc)
          }
          chiusoCentrale={isChiusoCentrale(rawDoc)}
          alertSlot={mobileAlertSlot}
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
