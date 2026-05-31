import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { collection, deleteField, doc, onSnapshot, Timestamp } from 'firebase/firestore';
import {
  ESITI_PAZIENTE,
  ESITO_ALTRO,
  ESITO_TRASPORTA,
  STATI_PAZIENTE,
} from '../../constants';
import { useImpostazioni } from '../../hooks/useImpostazioni';
import { useRegistryPartecipanti } from '../../hooks/useRegistryPartecipanti';
import { db } from '../../firebaseConfig';
import { useManifestazioneId } from '../../context/ManifestazioneContext';
import { cercaPerPettorale, etaDaDataNascita } from '../../lib/excelPartecipanti';
import { emptyMsbDetails, normalizeMsbDetails } from '../../lib/msbValutazione';
import { emptyMsaDetails, normalizeMsaDetails } from '../../lib/msaValutazione';
import { normalizeValutazioniSoccorso } from '../../lib/pazienteValutazioniSoccorso';
import { mergePatientDraftFromServer, patientDocToDraftFields } from '../../lib/pazienteDraftMerge';
import {
  listaOspedaliDestinazione,
  listaPmaImpostazioni,
  resolveDestinazionePaziente,
} from '../../lib/destinazioniOspedale';
import {
  isPazienteOriginePma,
  normalizeStatoPzPma,
  STATO_PZ_PMA,
  TIPO_PZ,
  statoPzPmaLabel,
} from '../../lib/pmaModule';
import { chiusuraCentraleLabel, isChiusoCentrale, isTrasportoCentraleModificabile, statoCentraleLabel } from '../../lib/pazienteStati';
import { pmaCodiceColoreConflictMessage } from '../../lib/pazienteSyncGuard';
import {
  moduliSchedaPaziente,
  moduliSchedaPazienteForCreate,
  mostraModuloPmaInSchedaCentrale,
  pmaIdDaPaziente,
  VISTA_SCHEDA,
} from '../../lib/pazienteSchedaModuli';
import { isSchedaInSolaVisione } from '../../lib/schedaSolaVisione';
import { SchedaUnlockBar } from './SchedaUnlockBar';
import {
  seedFromPazienteEvento,
  setPazientePmaInArrivo,
  statoPzPmaInArrivoIfAllowed,
  syncPmaStatoOnDestinazionePaziente,
} from '../../services/pazientePmaMissionSync';
import { PazienteModuloPma } from './moduli/PazienteModuloPma';
import { COLLECTIONS } from '../../lib/firestorePaths';
import {
  pazientiPath,
  pazienteValutazioniSoccorsoPathSegments,
} from '../../lib/firestorePaths';
import { useManifestazioneCollection } from '../../hooks/useManifestazioneCollection';
import { toDatetimeLocalValue, fromDatetimeLocalValue } from '../../lib/datetimeLocal';
import {
  fieldsPerEsito,
  mezziMissioniEvento,
  missionePerMezzo,
} from '../../lib/pazienteRules';
import {
  createPaziente,
  deletePazienteCascade,
  migrateLegacyValutazioniIfNeeded,
  newValutazioneSoccorsoItem,
  patchPaziente,
  payloadValutazioneRow,
  setValutazioneSoccorsoDoc,
  updateValutazioneSoccorsoDoc,
  deleteValutazioneSoccorsoDoc,
} from '../../services/pazientiService';
import {
  parseCodiceColoreOptional,
} from '../../lib/codiciColore';
import {
  syncMissioneCodiceColoreTrasportoForPaziente,
  syncPazienteCodiceColoreSanitario,
} from '../../services/missioniService';
import { ColoreSelectButtons } from '../ui/ColoreSelectButtons';
import { pazienteSameEventoAsMissione } from '../../lib/pazientiTrasportoQuery';
import { normalizeMezzoKey } from '../../lib/mezzoMissione';
import { findEvento, pazientiPerEvento } from '../../lib/eventoLinks';
import { pazienteEventoTipoDettaglio } from '../../lib/eventoDisplay';
import {
  findDestinazioneTrasportoSuMezzoEvento,
  mapDestinazionePerMezzoEvento,
  validateDestinazionePerMezzo,
} from '../../lib/mezzoDestinazioneTrasporto';
import { formatTimestamp } from '../../utils/formatters';
import { FormField, btnDanger, btnPrimary, btnSecondary, inputClass, selectClass } from '../ui/FormField';
import { ValutazioniSoccorsoTab } from './ValutazioniSoccorsoTab';
import { PazienteAnagraficaFields } from './PazienteAnagraficaFields';
import { ValutazioneMezzoButtons } from './ValutazioneMezzoButtons';
import { SoreuTrasportoFields } from './SoreuTrasportoFields';
import {
  defaultSoreuOraMissione,
  destinazioneRichiedeSoreu,
  soreuFieldsForFirestore,
  soreuFieldsFromPatient,
} from '../../lib/soreuTrasporto';

function emptyDraft() {
  return {
    aperta: true,
    creatoLocal: '',
    esito: '',
    esitoAltro: '',
    ospedaleDestinazione: '',
    destinazionePmaId: '',
    stato: 'ATTESA',
    mezzo: '',
    nome: '',
    cognome: '',
    eta: '',
    sesso: '',
    notePaziente: '',
    valutazioniSoccorso: [],
    ...soreuFieldsFromPatient(null),
    pettorale: '',
    telefono: '',
    comune: '',
    indirizzo: '',
    dataNascita: '',
    codiceColoreSanitario: '',
  };
}

function parseEtaDraft(s) {
  if (s === '' || s == null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function PazienteScheda({
  evento,
  paziente,
  missioniEvento = [],
  allPazienti = [],
  onClose,
  onSaved,
  onDeleted,
}) {
  const isCreate = !paziente;
  const manifestationId = useManifestazioneId();
  const patientDocId = paziente?._docId ?? null;
  const { impostazioni } = useImpostazioni();
  const { registryPartecipanti } = useRegistryPartecipanti(
    impostazioni?.registryPartecipanti ?? [],
  );
  const ospedali = useMemo(() => listaOspedaliDestinazione(impostazioni), [impostazioni]);
  const pmaDestinazioni = useMemo(() => listaPmaImpostazioni(impostazioni), [impostazioni]);
  const missioniSafe = missioniEvento ?? [];
  const mezziEvento = useMemo(() => mezziMissioniEvento(missioniSafe), [missioniSafe]);
  const { data: eventiAll } = useManifestazioneCollection(COLLECTIONS.eventi);

  const [serverPatient, setServerPatient] = useState(
    () => (!isCreate && paziente ? { ...paziente } : null),
  );

  /** Campi digitati localmente che non devono essere sovrascritti dai primi snapshot. */
  const dirtyPatientFieldsRef = useRef(new Set());
  const touchDirty = useCallback((key) => {
    dirtyPatientFieldsRef.current.add(key);
  }, []);

  const displayPatient = serverPatient ?? paziente ?? null;

  const eventoCollegato = useMemo(
    () =>
      evento ??
      findEvento(eventiAll, displayPatient?.eventoIdUnivoco ?? displayPatient?.eventoCorrelato),
    [evento, eventiAll, displayPatient?.eventoIdUnivoco, displayPatient?.eventoCorrelato],
  );

  const eventoTipoDettaglio = useMemo(
    () => pazienteEventoTipoDettaglio(displayPatient, eventoCollegato),
    [displayPatient, eventoCollegato],
  );

  const [draft, setDraft] = useState(() => {
    if (isCreate) return emptyDraft();
    return {
      ...patientDocToDraftFields(paziente),
      valutazioniSoccorso: [],
    };
  });

  const [valuationRows, setValuationRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [mainTab, setMainTab] = useState('centrale');
  const [patientSnapshotError, setPatientSnapshotError] = useState(null);
  /** Snapshot diretto sul documento paziente → merge preservando campi dirty. */
  useEffect(() => {
    if (isCreate || !patientDocId || !manifestationId) return undefined;
    setPatientSnapshotError(null);
    const dref = doc(db, ...pazientiPath(manifestationId), patientDocId);
    const unsub = onSnapshot(
      dref,
      (snap) => {
        if (!snap.exists()) return;
        setPatientSnapshotError(null);
        const row = { _docId: snap.id, ...snap.data() };
        setServerPatient(row);
        setDraft((prev) =>
          mergePatientDraftFromServer(prev, row, dirtyPatientFieldsRef.current),
        );
      },
      (err) => {
        console.error('[PazienteScheda] Snapshot paziente:', err);
        setPatientSnapshotError(
          err instanceof Error ? err.message : 'Aggiornamento scheda non disponibile.',
        );
      },
    );
    return () => unsub();
  }, [isCreate, patientDocId, manifestationId]);

  /** Valutazioni per documento dedicato → niente riscrittura dell’intero array. */
  useEffect(() => {
    if (isCreate || !patientDocId || !manifestationId) return undefined;
    const vcol = collection(
      db,
      ...pazienteValutazioniSoccorsoPathSegments(manifestationId, patientDocId),
    );
    const unsub = onSnapshot(vcol, (snap) => {
      const raw = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setValuationRows(normalizeValutazioniSoccorso(raw));
    });
    return () => unsub();
  }, [isCreate, patientDocId, manifestationId]);

  useEffect(() => {
    if (isCreate || !patientDocId || !manifestationId || !displayPatient) return;
    const legacy = displayPatient.valutazioniSoccorso;
    if (!Array.isArray(legacy) || legacy.length === 0) return;
    if (valuationRows.length > 0) return;
    void migrateLegacyValutazioniIfNeeded(manifestationId, patientDocId, legacy);
  }, [
    displayPatient?.valutazioniSoccorso,
    isCreate,
    patientDocId,
    manifestationId,
    valuationRows.length,
  ]);

  const isOriginePma = !isCreate && isPazienteOriginePma(displayPatient);
  const moduli = useMemo(() => {
    if (isCreate) return moduliSchedaPazienteForCreate(evento);
    if (!displayPatient) return null;
    return moduliSchedaPaziente(displayPatient);
  }, [isCreate, displayPatient, evento?.idEvento, evento?.idUnivoco]);
  const showEsitoTrasporto = Boolean(moduli?.esitoTrasporto);
  const mostraValutazioniMezzo = isCreate || (!isOriginePma && showEsitoTrasporto);
  const pmaIdScheda = displayPatient ? pmaIdDaPaziente(displayPatient) : '';
  const mostraTabPma = !isCreate && mostraModuloPmaInSchedaCentrale(displayPatient);
  const schedaSolaVisione =
    !isCreate && displayPatient ? isSchedaInSolaVisione(displayPatient) : false;

  const patchPatientFields = useCallback(
    async (fields, dirtyKeysToClear = []) => {
      if (!fields || Object.keys(fields).length === 0) return;
      if (isCreate) {
        setDraft((d) => ({ ...d, ...fields }));
        return;
      }
      if (schedaSolaVisione) return;
      await patchPaziente(manifestationId, patientDocId, fields);
      dirtyKeysToClear.forEach((k) => dirtyPatientFieldsRef.current.delete(k));
    },
    [isCreate, manifestationId, patientDocId, schedaSolaVisione],
  );

  const applyDestinazioneChange = useCallback(
    async (nomeSelezionato) => {
      if (displayPatient && !isTrasportoCentraleModificabile(displayPatient)) return;
      const mezzoAttivo = draft.mezzo || displayPatient?.mezzo;
      if (mezzoAttivo && String(nomeSelezionato ?? '').trim()) {
        const pazientiEvento = evento ? pazientiPerEvento(allPazienti, evento) : [];
        const check = validateDestinazionePerMezzo({
          mezzo: mezzoAttivo,
          nomeSelezionato,
          pazienti: pazientiEvento,
          evento,
          excludeDocId: patientDocId,
          impostazioni,
        });
        if (!check.ok) {
          alert(check.message);
          return;
        }
      }
      const dest = resolveDestinazionePaziente(nomeSelezionato, impostazioni);
      const soreuInit =
        dest.ospedaleDestinazione && !draft.soreuOraMissione
          ? { soreuOraMissione: defaultSoreuOraMissione() }
          : {};
      const patch = { ...dest, ...soreuInit };
      const nextPma = statoPzPmaInArrivoIfAllowed(displayPatient);
      if (dest.destinazionePmaId && nextPma) {
        patch.statoPzPma = nextPma;
      }
      ['ospedaleDestinazione', 'destinazionePmaId', 'pmaId', ...Object.keys(soreuInit)].forEach(
        touchDirty,
      );
      if (patch.statoPzPma) touchDirty('statoPzPma');
      setDraft((d) => ({ ...d, ...patch }));
      if (isCreate) return;
      await patchPatientFields(patch, Object.keys(patch));
      if (dest.destinazionePmaId && patientDocId) {
        const updated = { ...displayPatient, ...patch, _docId: patientDocId };
        await setPazientePmaInArrivo(manifestationId, patientDocId, updated, evento);
        const mis =
          missionePerMezzo(missioniSafe, updated.mezzo) ??
          missioniSafe.find(
            (m) =>
              m.aperta !== false &&
              (String(m.idMissione ?? '') === String(updated.idMissione ?? '') ||
                (updated.missioneIdUnivoco &&
                  m.idUnivoco === updated.missioneIdUnivoco)),
          ) ??
          null;
        if (mis) {
          await syncPmaStatoOnDestinazionePaziente(manifestationId, updated, mis, evento);
        }
      }
    },
    [
      draft.mezzo,
      draft.soreuOraMissione,
      allPazienti,
      impostazioni,
      isCreate,
      manifestationId,
      patientDocId,
      displayPatient,
      evento,
      missioniSafe,
      patchPatientFields,
      touchDirty,
    ],
  );

  useEffect(() => {
    if (isCreate && !draft.creatoLocal) {
      setDraft((d) => ({ ...d, creatoLocal: toDatetimeLocalValue(new Date()) }));
    }
  }, [isCreate, draft.creatoLocal]);

  useEffect(() => {
    if (!mostraValutazioniMezzo && (mainTab === 'msb' || mainTab === 'msa')) {
      setMainTab('centrale');
    }
  }, [mostraValutazioniMezzo, mainTab]);

  useEffect(() => {
    if (!displayPatient || !mostraTabPma) return;
    const dimesso = normalizeStatoPzPma(displayPatient.statoPzPma) === STATO_PZ_PMA.DIMESSO;
    if (dimesso) setMainTab('pma');
  }, [patientDocId, displayPatient?.statoPzPma, mostraTabPma]);

  const trasporta = draft.esito === ESITO_TRASPORTA;
  const trasportoModificabile =
    isCreate || (!schedaSolaVisione && isTrasportoCentraleModificabile(displayPatient));
  const showAltro = draft.esito === ESITO_ALTRO;
  const mostraSoreu = trasporta && destinazioneRichiedeSoreu(displayPatient ?? draft, impostazioni);

  const pazientiStessoEvento = useMemo(
    () => (evento ? pazientiPerEvento(allPazienti, evento) : []),
    [allPazienti, evento],
  );

  const destinazionePerMezzo = useMemo(
    () =>
      mapDestinazionePerMezzoEvento({
        mezziSigle: mezziEvento,
        pazienti: pazientiStessoEvento,
        evento,
        excludeDocId: patientDocId,
        impostazioni,
      }),
    [mezziEvento, pazientiStessoEvento, evento, patientDocId, impostazioni],
  );

  const destinazioneBloccataMezzo = useMemo(() => {
    if (!trasporta || !draft.mezzo) return null;
    return findDestinazioneTrasportoSuMezzoEvento({
      pazienti: pazientiStessoEvento,
      evento,
      mezzo: draft.mezzo,
      excludeDocId: patientDocId,
      impostazioni,
    });
  }, [trasporta, draft.mezzo, pazientiStessoEvento, evento, patientDocId, impostazioni]);

  const valutazioniList = useMemo(
    () =>
      isCreate
        ? normalizeValutazioniSoccorso(draft.valutazioniSoccorso ?? [])
        : valuationRows,
    [isCreate, draft.valutazioniSoccorso, valuationRows],
  );

  const addValutazione = async (tipo) => {
    if (schedaSolaVisione) return;
    const item = newValutazioneSoccorsoItem(tipo);
    if (isCreate) {
      setDraft((d) => ({
        ...d,
        valutazioniSoccorso: [...(d.valutazioniSoccorso ?? []), item],
      }));
      return;
    }
    await setValutazioneSoccorsoDoc(manifestationId, patientDocId, item);
  };

  const patchMsbValutazione = async (id, partial) => {
    if (isCreate) {
      const mergeOne = (v) => {
        if (v.id !== id || v.tipo !== 'MSB') return v;
        const merged = normalizeMsbDetails({ ...emptyMsbDetails(), ...v.msbDetails, ...partial });
        return { ...v, msbDetails: merged };
      };
      setDraft((d) => ({
        ...d,
        valutazioniSoccorso: (d.valutazioniSoccorso ?? []).map(mergeOne),
      }));
      return;
    }
    const row = valuationRows.find((r) => r.id === id);
    if (!row || row.tipo !== 'MSB') return;
    const merged = normalizeMsbDetails({
      ...emptyMsbDetails(),
      ...row.msbDetails,
      ...partial,
    });
    await updateValutazioneSoccorsoDoc(
      manifestationId,
      patientDocId,
      id,
      payloadValutazioneRow({ ...row, msbDetails: merged }),
    );
  };

  const patchMsaValutazione = async (id, partial) => {
    if (isCreate) {
      const mergeOne = (v) => {
        if (v.id !== id || v.tipo !== 'MSA') return v;
        const merged = normalizeMsaDetails({ ...emptyMsaDetails(), ...v.msaDetails, ...partial });
        return { ...v, msaDetails: merged, mezzo: partial.mezzoMsa ?? merged.mezzoMsa ?? v.mezzo };
      };
      setDraft((d) => ({
        ...d,
        valutazioniSoccorso: (d.valutazioniSoccorso ?? []).map(mergeOne),
      }));
      return;
    }
    const row = valuationRows.find((r) => r.id === id);
    if (!row || row.tipo !== 'MSA') return;
    const merged = normalizeMsaDetails({
      ...emptyMsaDetails(),
      ...row.msaDetails,
      ...partial,
    });
    await updateValutazioneSoccorsoDoc(
      manifestationId,
      patientDocId,
      id,
      payloadValutazioneRow({
        ...row,
        msaDetails: merged,
        mezzo: merged.mezzoMsa ?? row.mezzo ?? '',
      }),
    );
  };

  const patchMsaCreatoIl = async (id, creatoIl) => {
    if (isCreate) {
      setDraft((d) => ({
        ...d,
        valutazioniSoccorso: (d.valutazioniSoccorso ?? []).map((v) =>
          v.id === id ? { ...v, creatoIl } : v,
        ),
      }));
      return;
    }
    await updateValutazioneSoccorsoDoc(manifestationId, patientDocId, id, { creatoIl });
  };

  const removeValutazione = async (id) => {
    if (isCreate) {
      setDraft((d) => ({
        ...d,
        valutazioniSoccorso: (d.valutazioniSoccorso ?? []).filter((v) => v.id !== id),
      }));
      return;
    }
    await deleteValutazioneSoccorsoDoc(manifestationId, patientDocId, id);
    if (displayPatient) {
      await syncMissioneCodiceColoreTrasportoForPaziente(manifestationId, displayPatient);
    }
  };

  const onEsitoChange = async (esito) => {
    if (displayPatient && !isTrasportoCentraleModificabile(displayPatient)) return;
    const clearTrasporto = esito !== ESITO_TRASPORTA;
    const fields =
      esito === ESITO_TRASPORTA && draft.mezzo
        ? fieldsPerEsito(esito, {
            mezzo: draft.mezzo,
            missione: missionePerMezzo(missioniSafe, draft.mezzo, evento ?? eventoCollegato),
          })
        : fieldsPerEsito(esito, { clearTrasporto });
    const soreuKeys = [
      'esito',
      'mezzo',
      'stato',
      'idMissione',
      'missioneIdUnivoco',
      'ospedaleDestinazione',
      'destinazionePmaId',
      'pmaId',
      'statoPzPma',
      'soreuOraMissione',
      'soreuNumeroMissione',
      'soreuAccompagnato',
      'soreuCodice',
    ];
    soreuKeys.forEach(touchDirty);
    setDraft((d) => ({ ...d, ...fields, esitoAltro: clearTrasporto ? '' : d.esitoAltro }));
    if (!isCreate) {
      await patchPatientFields(fields, soreuKeys);
    }
  };

  const onCodiceColoreChange = async (colore) => {
    if (schedaSolaVisione) return;
    const valid = parseCodiceColoreOptional(colore);
    touchDirty('codiceColoreSanitario');
    setDraft((d) => ({ ...d, codiceColoreSanitario: valid ?? '' }));
    if (isCreate) return;

    const pazienteRef = { ...displayPatient, _docId: patientDocId };
    const { pmaResult } = await syncPazienteCodiceColoreSanitario(
      manifestationId,
      pazienteRef,
      valid,
    );

    if (pmaResult?.conflict) {
      const applyPma = window.confirm(pmaCodiceColoreConflictMessage(pmaResult.conflict));
      if (applyPma) {
        await syncPazienteCodiceColoreSanitario(manifestationId, pazienteRef, valid, {
          pmaColoreForceApply: true,
        });
      }
    }
  };

  const onMezzoChange = async (mezzo) => {
    if (displayPatient && !isTrasportoCentraleModificabile(displayPatient)) return;
    const mis = missionePerMezzo(missioniSafe, mezzo, evento ?? eventoCollegato);
    const pazientiEvento = evento ? pazientiPerEvento(allPazienti, evento) : [];
    const ref = findDestinazioneTrasportoSuMezzoEvento({
      pazienti: pazientiEvento,
      evento,
      mezzo,
      excludeDocId: patientDocId,
      impostazioni,
    });
    const destDaMezzo = ref
      ? {
          ospedaleDestinazione: ref.ospedaleDestinazione,
          destinazionePmaId: ref.destinazionePmaId,
          pmaId: ref.pmaId,
          ...(ref.destinazionePmaId && statoPzPmaInArrivoIfAllowed(displayPatient)
            ? { statoPzPma: statoPzPmaInArrivoIfAllowed(displayPatient) }
            : {}),
        }
      : {};
    const fields = { ...fieldsPerEsito(ESITO_TRASPORTA, { mezzo, missione: mis }), ...destDaMezzo };
    const patchKeys = [
      'mezzo',
      'stato',
      'idMissione',
      'missioneIdUnivoco',
      ...Object.keys(destDaMezzo),
    ];
    patchKeys.forEach(touchDirty);
    setDraft((d) => ({ ...d, ...fields }));
    if (!isCreate) {
      await patchPatientFields(fields, patchKeys);
      const updated = { ...displayPatient, ...fields, _docId: patientDocId };
      if (ref?.destinazionePmaId && patientDocId) {
        await setPazientePmaInArrivo(manifestationId, patientDocId, updated, evento);
      }
      await syncMissioneCodiceColoreTrasportoForPaziente(manifestationId, updated);
    }
  };

  const handleCreate = async () => {
    if (!evento?.idEvento && !evento?.idUnivoco) {
      alert('Evento non valido: chiudi e riapri la scheda evento.');
      return;
    }
    setSaving(true);
    try {
      if (draft.esito === ESITO_TRASPORTA && draft.mezzo && String(draft.ospedaleDestinazione ?? '').trim()) {
        const pazientiEvento = evento ? pazientiPerEvento(allPazienti, evento) : [];
        const check = validateDestinazionePerMezzo({
          mezzo: draft.mezzo,
          nomeSelezionato: draft.ospedaleDestinazione,
          pazienti: pazientiEvento,
          evento,
          impostazioni,
        });
        if (!check.ok) {
          alert(check.message);
          return;
        }
      }
      const creato = fromDatetimeLocalValue(draft.creatoLocal);
      const mis = missionePerMezzo(missioniSafe, draft.mezzo);
      const pmaSchedaSeed =
        trasporta && String(draft.destinazionePmaId ?? '').trim()
          ? seedFromPazienteEvento(
              { codiceColoreSanitario: draft.codiceColoreSanitario },
              evento,
            )
          : null;
      const created = await createPaziente(
        manifestationId,
        {
          eventoIdUnivoco: evento.idUnivoco ?? '',
          eventoCorrelato: evento.idEvento ?? '',
          ...(Object.keys(pmaSchedaSeed ?? {}).length ? { pmaSchedaSeed } : {}),
          aperta: draft.aperta,
          apertura: creato ? Timestamp.fromDate(creato) : undefined,
          esito: draft.esito,
          esitoAltro: showAltro ? draft.esitoAltro : '',
          ospedaleDestinazione: trasporta ? draft.ospedaleDestinazione : '',
          destinazionePmaId: trasporta ? draft.destinazionePmaId ?? '' : '',
          pmaId: trasporta ? draft.destinazionePmaId ?? '' : '',
          tipoPz: TIPO_PZ.CENTRALE,
          statoPzPma:
            trasporta && String(draft.destinazionePmaId ?? '').trim()
              ? STATO_PZ_PMA.IN_ARRIVO
              : null,
          ...(trasporta ? soreuFieldsForFirestore(draft) : {}),
          stato: draft.stato,
          mezzo: trasporta ? draft.mezzo : '',
          idMissione: trasporta ? mis?.idMissione ?? '' : '',
          missioneIdUnivoco: trasporta ? mis?.idUnivoco ?? '' : '',
          codiceColoreSanitario: draft.codiceColoreSanitario ?? '',
          nome: draft.nome,
          cognome: draft.cognome,
          eta: parseEtaDraft(draft.eta),
          sesso: draft.sesso,
          notePaziente: draft.notePaziente,
          pettorale:
            draft.pettorale !== '' && draft.pettorale != null ? Number(draft.pettorale) : null,
          telefono: draft.telefono ?? '',
          dataNascita: draft.dataNascita ?? '',
          valutazioniSoccorso: (draft.valutazioniSoccorso ?? []).map((v) => {
            const base = {
              id: v.id,
              tipo: v.tipo,
              testo: v.testo ?? '',
              creatoIl: v.creatoIl ?? Timestamp.now(),
            };
            if (v.tipo === 'MSB') {
              return { ...base, msbDetails: normalizeMsbDetails(v.msbDetails) };
            }
            const msa = normalizeMsaDetails(v.msaDetails);
            return {
              ...base,
              msaDetails: msa,
              mezzo: v.mezzo ?? msa.mezzoMsa ?? '',
            };
          }),
        },
        allPazienti ?? [],
      );
      if (trasporta && draft.mezzo && parseCodiceColoreOptional(draft.codiceColoreSanitario)) {
        await syncMissioneCodiceColoreTrasportoForPaziente(manifestationId, {
          _docId: created.docId,
          mezzo: draft.mezzo,
          idMissione: mis?.idMissione ?? '',
          missioneIdUnivoco: mis?.idUnivoco ?? '',
          codiceColoreSanitario: draft.codiceColoreSanitario,
        });
      }
      onSaved?.();
      onClose?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      alert('Errore: ' + msg);
    } finally {
      setSaving(false);
    }
  };

  const cercaPettoraleInElenco = async () => {
    const hit = cercaPerPettorale(registryPartecipanti, draft.pettorale);
    if (!hit) {
      alert(
        'Pettorale non trovato. Carica l’Excel partecipanti in Impostazioni (tab Mezzi e strutture).',
      );
      return;
    }
    const etaNum = etaDaDataNascita(hit.dataNascita);
    ['nome', 'cognome', 'telefono', 'dataNascita', 'pettorale', 'eta'].forEach(touchDirty);
    const fields = {
      nome: hit.nome ?? '',
      cognome: hit.cognome ?? '',
      telefono: hit.telefono ?? '',
      dataNascita: hit.dataNascita ?? '',
      eta: etaNum != null ? String(etaNum) : '',
      pettorale: String(hit.pettorale),
    };
    setDraft((d) => ({ ...d, ...fields }));
    if (!isCreate) {
      await patchPatientFields(
        {
          nome: fields.nome,
          cognome: fields.cognome,
          telefono: fields.telefono,
          dataNascita: fields.dataNascita,
          eta: etaNum,
          pettorale: hit.pettorale,
        },
        ['nome', 'cognome', 'telefono', 'dataNascita', 'pettorale', 'eta'],
      );
    }
  };

  const anagraficaCentralePanel = (
    <div className="space-y-4 p-1">
      {isOriginePma && (
        <FormField label="Stato PMA">
          <p className="font-semibold text-violet-900">
            {statoPzPmaLabel(displayPatient?.statoPzPma) ?? '—'}
          </p>
        </FormField>
      )}
      <div className={isOriginePma ? 'border-t border-slate-200 pt-3' : ''}>
        <p className="mb-2 text-xs font-bold uppercase text-slate-600">Anagrafica</p>
        <PazienteAnagraficaFields
          draft={draft}
          registryAvailable={registryPartecipanti.length > 0}
          onSearchPettorale={cercaPettoraleInElenco}
          onChange={(key, value) => {
            touchDirty(key);
            setDraft((d) => ({ ...d, [key]: value }));
          }}
          onBlurField={(key) => {
            if (key === 'pettorale') {
              void patchPatientFields(
                {
                  pettorale:
                    draft.pettorale !== '' && draft.pettorale != null
                      ? Number(draft.pettorale)
                      : null,
                },
                ['pettorale'],
              );
              return;
            }
            if (key === 'dataNascita') {
              void patchPatientFields(
                {
                  dataNascita: draft.dataNascita,
                  eta: etaDaDataNascita(draft.dataNascita),
                },
                ['dataNascita', 'eta'],
              );
              return;
            }
            if (key === 'eta') {
              void patchPatientFields({ eta: parseEtaDraft(draft.eta) }, ['eta']);
              return;
            }
            if (key === 'sesso') {
              void patchPatientFields({ sesso: draft.sesso }, ['sesso']);
              return;
            }
            void patchPatientFields({ [key]: draft[key] ?? '' }, [key]);
          }}
        />
      </div>
    </div>
  );

  const datiCentraleCentralePanel =
    !isOriginePma && showEsitoTrasporto ? (
      <div className="space-y-4 p-1">
        <dl className="grid gap-3 md:grid-cols-2">
          <FormField label="Evento correlato">
            <p className="font-mono font-semibold text-slate-800">
              {eventoCollegato?.idEvento ?? displayPatient?.eventoCorrelato ?? '—'}
            </p>
          </FormField>
          <FormField label="Tipo evento">
            <p className="text-slate-800">{eventoTipoDettaglio.tipo || '—'}</p>
          </FormField>
          <FormField label="Dettaglio evento" className="md:col-span-2">
            <p className="whitespace-pre-wrap text-slate-800">
              {eventoTipoDettaglio.dettaglio || '—'}
            </p>
          </FormField>
          {!isCreate && displayPatient?.idMissione && (
            <FormField label="ID missione">
              <p className="font-mono text-slate-800">{displayPatient.idMissione}</p>
            </FormField>
          )}
          {!isCreate && displayPatient?.stato === 'ARRIVATO H' && (
            <FormField label="Arrivato in H">
              <p className="text-slate-800">{formatTimestamp(displayPatient.arrivatoHAt)}</p>
            </FormField>
          )}
          {!isCreate && (
            <>
              <FormField label="Stato centrale (missione)">
                <p className="font-semibold text-slate-800">
                  {statoCentraleLabel(displayPatient)}
                  {chiusuraCentraleLabel(displayPatient) && (
                    <span className="ml-2 text-xs font-normal text-slate-500">
                      ({chiusuraCentraleLabel(displayPatient)})
                    </span>
                  )}
                </p>
              </FormField>
              <FormField label="Stato PMA">
                <p className="font-semibold text-violet-900">
                  {statoPzPmaLabel(displayPatient?.statoPzPma) ??
                    (displayPatient?.destinazionePmaId ? 'In attesa mezzo' : '—')}
                </p>
              </FormField>
            </>
          )}
        </dl>
        {showEsitoTrasporto && (
          <div className="border-t border-slate-200 pt-3">
            <p className="mb-2 text-xs font-bold uppercase text-slate-600">Esito e trasporto</p>
            {!trasportoModificabile && (
              <p className="mb-3 rounded bg-slate-100 px-3 py-2 text-xs text-slate-600">
                Missione conclusa o paziente in percorso PMA — esito, mezzo e destinazione non
                modificabili.
              </p>
            )}
            <div className="mb-4 space-y-3">
              {!isOriginePma && (
                <FormField label="Codice colore paziente">
                  <ColoreSelectButtons
                    value={draft.codiceColoreSanitario}
                    disabled={schedaSolaVisione}
                    onChange={(c) => void onCodiceColoreChange(c)}
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Il codice colore del paziente imposta automaticamente il codice T del mezzo
                    collegato.
                  </p>
                </FormField>
              )}
              <FormField label="Esito">
                <select
                  className={selectClass}
                  value={draft.esito}
                  disabled={!trasportoModificabile}
                  onChange={(e) => onEsitoChange(e.target.value)}
                >
                  <option value="">—</option>
                  {ESITI_PAZIENTE.map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </select>
              </FormField>
              {showAltro && (
                <FormField label="Specificare esito">
                  <textarea
                    className={inputClass}
                    rows={2}
                    value={draft.esitoAltro}
                    onChange={(e) => {
                      touchDirty('esitoAltro');
                      setDraft((d) => ({ ...d, esitoAltro: e.target.value }));
                    }}
                    onBlur={(e) => patchPatientFields({ esitoAltro: e.target.value }, ['esitoAltro'])}
                  />
                </FormField>
              )}
              {trasporta && (
                <>
                  <FormField label="Mezzo (missioni evento)">
                    <select
                      className={selectClass}
                      value={draft.mezzo}
                      disabled={!trasportoModificabile}
                      onChange={(e) => onMezzoChange(e.target.value)}
                    >
                      <option value="">—</option>
                      {mezziEvento.map((sigla) => {
                        const destLabel = destinazionePerMezzo.get(normalizeMezzoKey(sigla));
                        return (
                          <option key={sigla} value={sigla}>
                            {sigla}
                            {destLabel ? ` — destinazione: ${destLabel}` : ''}
                          </option>
                        );
                      })}
                    </select>
                    {destinazioneBloccataMezzo ? (
                      <p className="mt-1 text-xs text-amber-800">
                        Questo mezzo ha già destinazione «{destinazioneBloccataMezzo.label}»: tutti i
                        pazienti sullo stesso mezzo condividono la stessa destinazione.
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-slate-500">
                        La prima destinazione scelta sul mezzo vale per gli altri pazienti dello
                        stesso mezzo.
                      </p>
                    )}
                  </FormField>
                  <FormField label="Ospedale destinazione">
                    <select
                      className={selectClass}
                      value={draft.ospedaleDestinazione}
                      disabled={!trasportoModificabile || Boolean(destinazioneBloccataMezzo)}
                      onChange={(e) => void applyDestinazioneChange(e.target.value)}
                    >
                      <option value="">—</option>
                      {ospedali.map((h) => (
                        <option key={`osp-${h}`} value={h}>
                          {h}
                        </option>
                      ))}
                      {pmaDestinazioni.length > 0 && (
                        <optgroup label="PMA">
                          {pmaDestinazioni.map((p) => (
                            <option key={`pma-${p.id}`} value={p.nome}>
                              PMA — {p.nome}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </FormField>
                  {mostraSoreu && draft.ospedaleDestinazione && (
                    <SoreuTrasportoFields
                      values={draft}
                      onPatch={(partial) => {
                        Object.keys(partial).forEach(touchDirty);
                        setDraft((d) => ({ ...d, ...partial }));
                        void patchPatientFields(partial, Object.keys(partial));
                      }}
                    />
                  )}
                  <FormField label="Stato paziente">
                    <select className={selectClass} value={draft.stato} disabled>
                      {STATI_PAZIENTE.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </FormField>
                </>
              )}
              {!trasporta && draft.esito && (
                <FormField label="Stato paziente">
                  <p className="font-semibold text-slate-700">{draft.stato || 'ATTESA'}</p>
                </FormField>
              )}
            </div>
          </div>
        )}
      </div>
    ) : undefined;

  if (isCreate && !evento?.idEvento && !evento?.idUnivoco) {
    return (
      <div className="space-y-3 text-sm">
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-900" role="alert">
          Evento non valido: impossibile creare il paziente. Chiudi e riapri la scheda evento.
        </p>
        <button type="button" className={btnSecondary} onClick={onClose}>
          Chiudi
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-sm">
      {isCreate && (
        <p className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs text-teal-950">
          Nuovo paziente per evento <strong className="font-mono">{evento?.idEvento}</strong>
        </p>
      )}
      {patientSnapshotError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900" role="alert">
          {patientSnapshotError} — i dati mostrati potrebbero non essere aggiornati.
        </p>
      ) : null}
      {!isCreate && displayPatient && (
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 pb-3">
          <span className="font-mono text-xl font-bold text-teal-800">
            {displayPatient.idPaziente}
          </span>
          <span className="font-mono text-xs text-slate-500">{displayPatient.idUnivoco}</span>
          {!isOriginePma && displayPatient?.stato !== 'ARRIVATO H' && !isChiusoCentrale(displayPatient) && (
          <label className="ml-auto flex items-center gap-2">
            <input
              type="checkbox"
              checked={draft.aperta}
              disabled={schedaSolaVisione}
              onChange={(e) => {
                const aperta = e.target.checked;
                if (
                  !aperta &&
                  displayPatient?.esito === ESITO_TRASPORTA &&
                  displayPatient?.stato !== 'ARRIVATO H'
                ) {
                  alert(
                    'Non puoi chiudere la scheda centrale finché il trasporto non è concluso (ARRIVATO H).',
                  );
                  return;
                }
                touchDirty('aperta');
                setDraft((d) => ({ ...d, aperta }));
                void patchPatientFields({ aperta }, ['aperta']);
              }}
            />
            Aperto (centrale)
          </label>
          )}
          {!schedaSolaVisione && (
            <button
              type="button"
              className={`${btnDanger} ml-auto`}
              onClick={async () => {
                const label = displayPatient.idPaziente ?? displayPatient.idUnivoco ?? 'questo paziente';
                if (!window.confirm(`Eliminare definitivamente ${label}?\n\nL'operazione è irreversibile e rimuove anche tutte le valutazioni associate.`)) return;
                await deletePazienteCascade(manifestationId, patientDocId);
                onDeleted?.();
                onClose?.();
              }}
            >
              Elimina paziente
            </button>
          )}
        </div>
      )}

      {!isCreate && displayPatient ? (
        <SchedaUnlockBar
          paziente={displayPatient}
          busy={unlockBusy}
          onToggleModifica={async (forced) => {
            if (!manifestationId || !patientDocId) return;
            setUnlockBusy(true);
            try {
              await patchPaziente(manifestationId, patientDocId, {
                schedaModificaForzata: forced,
              });
            } finally {
              setUnlockBusy(false);
            }
          }}
        />
      ) : null}

      <div className="flex flex-wrap gap-1 border-b border-slate-300" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mainTab === 'centrale'}
          className={
            mainTab === 'centrale'
              ? 'border-b-2 border-teal-600 px-3 py-2 text-xs font-bold uppercase text-teal-800 sm:px-4'
              : 'px-3 py-2 text-xs font-bold uppercase text-slate-500 hover:text-slate-700 sm:px-4'
          }
          onClick={() => setMainTab('centrale')}
        >
          Valutazioni centrale
        </button>
        {mostraValutazioniMezzo ? (
          <>
            <button
              type="button"
              role="tab"
              aria-selected={mainTab === 'msb'}
              className={
                mainTab === 'msb'
                  ? 'border-b-2 border-teal-600 px-3 py-2 text-xs font-bold uppercase text-teal-800 sm:px-4'
                  : 'px-3 py-2 text-xs font-bold uppercase text-slate-500 hover:text-slate-700 sm:px-4'
              }
              onClick={() => setMainTab('msb')}
            >
              MSB
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mainTab === 'msa'}
              className={
                mainTab === 'msa'
                  ? 'border-b-2 border-violet-600 px-3 py-2 text-xs font-bold uppercase text-violet-900 sm:px-4'
                  : 'px-3 py-2 text-xs font-bold uppercase text-slate-500 hover:text-slate-700 sm:px-4'
              }
              onClick={() => setMainTab('msa')}
            >
              MSA
            </button>
          </>
        ) : null}
        {mostraTabPma ? (
          <button
            type="button"
            role="tab"
            aria-selected={mainTab === 'pma'}
            className={
              mainTab === 'pma'
                ? 'border-b-2 border-violet-600 px-3 py-2 text-xs font-bold uppercase text-violet-900 sm:px-4'
                : 'px-3 py-2 text-xs font-bold uppercase text-slate-500 hover:text-slate-700 sm:px-4'
            }
            onClick={() => setMainTab('pma')}
          >
            PMA
          </button>
        ) : null}
      </div>

      {mainTab === 'centrale' && (
        <div className="space-y-4">
          {anagraficaCentralePanel}
          {datiCentraleCentralePanel}
        </div>
      )}

      {mostraValutazioniMezzo && mainTab === 'msb' ? (
        <ValutazioniSoccorsoTab
          tipo="MSB"
          valutazioniList={valutazioniList}
          schedaSolaVisione={schedaSolaVisione}
          mezziEvento={mezziEvento}
          onAdd={addValutazione}
          onRemove={removeValutazione}
          onPatchMsb={patchMsbValutazione}
          onPatchMsa={patchMsaValutazione}
          onPatchMsaCreatoIl={patchMsaCreatoIl}
        />
      ) : null}

      {mostraValutazioniMezzo && mainTab === 'msa' ? (
        <ValutazioniSoccorsoTab
          tipo="MSA"
          valutazioniList={valutazioniList}
          schedaSolaVisione={schedaSolaVisione}
          mezziEvento={mezziEvento}
          onAdd={addValutazione}
          onRemove={removeValutazione}
          onPatchMsb={patchMsbValutazione}
          onPatchMsa={patchMsaValutazione}
          onPatchMsaCreatoIl={patchMsaCreatoIl}
        />
      ) : null}

      {mostraTabPma && mainTab === 'pma' ? (
        <div id="modulo-pma" className="min-h-[320px]">
          <PazienteModuloPma
            patientDocId={patientDocId}
            pmaId={pmaIdScheda}
            eventi={eventiAll}
            evento={evento}
            missioniEvento={missioniSafe}
            vistaScheda={VISTA_SCHEDA.CENTRALE}
            defaultTab="cartella"
            clinicalOnly
            hideSchedaUnlockBar
          />
        </div>
      ) : null}

      <div className="flex gap-2 border-t border-slate-200 pt-3">
        {isCreate ? (
          <>
            <button type="button" className={btnPrimary} disabled={saving} onClick={handleCreate}>
              {saving ? 'Salvataggio…' : 'Crea paziente'}
            </button>
            <button type="button" className={btnSecondary} disabled={saving} onClick={onClose}>
              Annulla
            </button>
          </>
        ) : (
          <button type="button" className={btnSecondary} onClick={onClose}>
            Chiudi
          </button>
        )}
      </div>
    </div>
  );
}
