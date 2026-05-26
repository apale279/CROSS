import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { collection, deleteField, doc, onSnapshot, Timestamp } from 'firebase/firestore';
import { Trash2 } from 'lucide-react';
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
import { MsaValutazioneForm } from './MsaValutazioneForm';
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
  setPazientePmaInArrivo,
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
  migrateLegacyValutazioniIfNeeded,
  newValutazioneSoccorsoItem,
  patchPaziente,
  payloadValutazioneRow,
  setValutazioneSoccorsoDoc,
  updateValutazioneSoccorsoDoc,
  deleteValutazioneSoccorsoDoc,
  transitionPazienteArrivatoHTransaction,
} from '../../services/pazientiService';
import { codiceColoreSanitarioFromValutazioni } from '../../lib/codiciColore';
import { patchMissioneCodiceColoreFromPaziente } from '../../services/missioniService';
import { pazienteSameEventoAsMissione } from '../../lib/pazientiTrasportoQuery';
import { sameMezzoSigla } from '../../lib/mezzoMissione';
import { formatTimestamp } from '../../utils/formatters';
import { FormField, btnPrimary, btnSecondary, inputClass, selectClass } from '../ui/FormField';
import { MsbValutazioneForm } from './MsbValutazioneForm';
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
    dataNascita: '',
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
  const arrivatoHSyncKeyRef = useRef('');

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

  useEffect(() => {
    /* Ogni scheda aggiorna solo questo paziente; la missione in ARRIVATO H vale per tutti sullo stesso mezzo anche via syncPazientiArrivatoH. */
    if (isCreate || !displayPatient || displayPatient.esito !== ESITO_TRASPORTA) return;
    if (displayPatient.stato === 'ARRIVATO H') return;
    const mis = missioniSafe.find((m) => {
      if (!sameMezzoSigla(m.mezzo, displayPatient.mezzo) || m.stato !== 'ARRIVATO H') {
        return false;
      }
      if (displayPatient.missioneIdUnivoco) {
        return m.idUnivoco === displayPatient.missioneIdUnivoco;
      }
      return pazienteSameEventoAsMissione(displayPatient, m);
    });
    if (!mis) return;
    const syncKey = `${patientDocId}:${mis._docId ?? mis.idUnivoco}`;
    if (arrivatoHSyncKeyRef.current === syncKey) return;
    arrivatoHSyncKeyRef.current = syncKey;
    void transitionPazienteArrivatoHTransaction(manifestationId, patientDocId, evento).catch(
      (err) => {
        arrivatoHSyncKeyRef.current = '';
        console.error('[PazienteScheda] Sync ARRIVATO H:', err);
      },
    );
  }, [missioniSafe, displayPatient, isCreate, manifestationId, patientDocId, evento]);

  const isOriginePma = !isCreate && isPazienteOriginePma(displayPatient);
  const moduli = useMemo(() => {
    if (isCreate) return moduliSchedaPazienteForCreate(evento);
    if (!displayPatient) return null;
    return moduliSchedaPaziente(displayPatient);
  }, [isCreate, displayPatient, evento?.idEvento, evento?.idUnivoco]);
  const showEsitoTrasporto = Boolean(moduli?.esitoTrasporto);
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
      const dest = resolveDestinazionePaziente(nomeSelezionato, impostazioni);
      const soreuInit =
        dest.ospedaleDestinazione && !draft.soreuOraMissione
          ? { soreuOraMissione: defaultSoreuOraMissione() }
          : {};
      const patch = { ...dest, ...soreuInit };
      const draftExtras =
        isCreate && dest.destinazionePmaId ? { statoPzPma: STATO_PZ_PMA.IN_ARRIVO } : {};
      ['ospedaleDestinazione', 'destinazionePmaId', 'pmaId', ...Object.keys(soreuInit)].forEach(
        touchDirty,
      );
      if (draftExtras.statoPzPma) touchDirty('statoPzPma');
      setDraft((d) => ({ ...d, ...patch, ...draftExtras }));
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
      draft.soreuOraMissione,
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
    if (!displayPatient || !mostraTabPma) {
      setMainTab('centrale');
      return;
    }
    const dimesso = normalizeStatoPzPma(displayPatient.statoPzPma) === STATO_PZ_PMA.DIMESSO;
    setMainTab(dimesso ? 'pma' : 'centrale');
  }, [patientDocId, displayPatient?.statoPzPma, mostraTabPma]);

  const trasporta = draft.esito === ESITO_TRASPORTA;
  const trasportoModificabile =
    isCreate || (!schedaSolaVisione && isTrasportoCentraleModificabile(displayPatient));
  const showAltro = draft.esito === ESITO_ALTRO;
  const mostraSoreu = trasporta && destinazioneRichiedeSoreu(displayPatient ?? draft, impostazioni);

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
    if ('codiceColore' in partial && displayPatient) {
      await patchMissioneCodiceColoreFromPaziente(
        manifestationId,
        displayPatient,
        merged.codiceColore,
      );
    }
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
    if ('codiceColore' in partial && displayPatient) {
      await patchMissioneCodiceColoreFromPaziente(
        manifestationId,
        displayPatient,
        merged.codiceColore,
      );
    }
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
      const remaining = valuationRows.filter((v) => v.id !== id);
      const colore = codiceColoreSanitarioFromValutazioni(remaining);
      await patchMissioneCodiceColoreFromPaziente(
        manifestationId,
        displayPatient,
        colore,
      );
    }
  };

  const onEsitoChange = async (esito) => {
    if (displayPatient && !isTrasportoCentraleModificabile(displayPatient)) return;
    const clearTrasporto = esito !== ESITO_TRASPORTA;
    const fields =
      esito === ESITO_TRASPORTA && draft.mezzo
        ? fieldsPerEsito(esito, {
            mezzo: draft.mezzo,
            missione: missionePerMezzo(missioniSafe, draft.mezzo),
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

  const onMezzoChange = async (mezzo) => {
    if (displayPatient && !isTrasportoCentraleModificabile(displayPatient)) return;
    const mis = missionePerMezzo(missioniSafe, mezzo);
    const fields = fieldsPerEsito(ESITO_TRASPORTA, { mezzo, missione: mis });
    const mezzoKeys = ['mezzo', 'stato', 'idMissione', 'missioneIdUnivoco'];
    mezzoKeys.forEach(touchDirty);
    setDraft((d) => ({ ...d, ...fields }));
    if (!isCreate) {
      await patchPatientFields(fields, mezzoKeys);
    }
  };

  const handleCreate = async () => {
    if (!evento?.idEvento && !evento?.idUnivoco) {
      alert('Evento non valido: chiudi e riapri la scheda evento.');
      return;
    }
    setSaving(true);
    try {
      const creato = fromDatetimeLocalValue(draft.creatoLocal);
      const mis = missionePerMezzo(missioniSafe, draft.mezzo);
      await createPaziente(
        manifestationId,
        {
          eventoIdUnivoco: evento.idUnivoco ?? '',
          eventoCorrelato: evento.idEvento ?? '',
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

  const onCreatoBlur = async () => {
    if (isCreate) return;
    const date = fromDatetimeLocalValue(draft.creatoLocal);
    const prev = toDatetimeLocalValue(displayPatient?.apertura);
    if (draft.creatoLocal === prev) return;
    await patchPatientFields(
      { apertura: date ? Timestamp.fromDate(date) : deleteField() },
      ['creatoLocal'],
    );
  };

  const anagraficaCentralePanel = (
    <div className="space-y-4 p-1">
      {isOriginePma && (
        <dl className="grid gap-3 md:grid-cols-2">
          <FormField label="Creato">
            <input
              type="datetime-local"
              className={`${inputClass} font-mono`}
              value={draft.creatoLocal}
              onChange={(e) => {
                touchDirty('creatoLocal');
                setDraft((d) => ({ ...d, creatoLocal: e.target.value }));
              }}
              onBlur={onCreatoBlur}
            />
          </FormField>
          <FormField label="Stato PMA">
            <p className="font-semibold text-violet-900">
              {statoPzPmaLabel(displayPatient?.statoPzPma) ?? '—'}
            </p>
          </FormField>
        </dl>
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
            <p className="font-mono font-semibold text-slate-800">{evento?.idEvento ?? '—'}</p>
          </FormField>
          {!isCreate && displayPatient?.idMissione && (
            <FormField label="ID missione">
              <p className="font-mono text-slate-800">{displayPatient.idMissione}</p>
            </FormField>
          )}
          <FormField label="Creato">
            <input
              type="datetime-local"
              className={`${inputClass} font-mono`}
              value={draft.creatoLocal}
              onChange={(e) => {
                touchDirty('creatoLocal');
                setDraft((d) => ({ ...d, creatoLocal: e.target.value }));
              }}
              onBlur={onCreatoBlur}
            />
          </FormField>
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
                      {mezziEvento.map((sigla) => (
                        <option key={sigla} value={sigla}>
                          {sigla}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="Ospedale destinazione">
                    <select
                      className={selectClass}
                      value={draft.ospedaleDestinazione}
                      disabled={!trasportoModificabile}
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
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase text-slate-600">
                Valutazioni mezzi di soccorso
              </p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  className={`${btnSecondary} px-2 py-1 text-xs font-semibold`}
                  onClick={() => addValutazione('MSB')}
                >
                  + VALUTAZIONE MSB
                </button>
                <button
                  type="button"
                  className={`${btnSecondary} px-2 py-1 text-xs font-semibold`}
                  onClick={() => addValutazione('MSA')}
                >
                  + VALUTAZIONE MSA
                </button>
              </div>
            </div>
            {valutazioniList.length === 0 ? (
              <p className="text-xs text-slate-500">Nessuna valutazione. Aggiungi MSB o MSA.</p>
            ) : (
              <ul className="space-y-3">
                {valutazioniList.map((v) => (
                  <li
                    key={v.id}
                    className="rounded-lg border border-teal-200/80 bg-teal-50/30 p-3"
                  >
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          v.tipo === 'MSA'
                            ? 'bg-violet-200 text-violet-900'
                            : 'bg-teal-200 text-teal-900'
                        }`}
                      >
                        {v.tipo === 'MSA' ? 'VALUTAZIONE MSA' : 'VALUTAZIONE MSB'}
                      </span>
                      <div className="flex items-center gap-2">
                        {v.creatoIl && (
                          <span className="text-[10px] text-slate-500">
                            {formatTimestamp(v.creatoIl)}
                          </span>
                        )}
                        <button
                          type="button"
                          className="rounded p-1 text-slate-400 hover:bg-red-100 hover:text-red-700"
                          title="Rimuovi valutazione"
                          onClick={() => removeValutazione(v.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    {v.tipo === 'MSB' ? (
                      <MsbValutazioneForm
                        valuationId={v.id}
                        msbDetails={v.msbDetails}
                        mezziEventoSigle={mezziEvento}
                        onPatch={(partial) => void patchMsbValutazione(v.id, partial)}
                      />
                    ) : (
                      <MsaValutazioneForm
                        valuationId={v.id}
                        msaDetails={v.msaDetails}
                        creatoIl={v.creatoIl}
                        mezziEventoSigle={mezziEvento}
                        onPatchDetails={(partial) => void patchMsaValutazione(v.id, partial)}
                        onPatchCreatoIl={(creatoIl) => void patchMsaCreatoIl(v.id, creatoIl)}
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
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
                touchDirty('aperta');
                setDraft((d) => ({ ...d, aperta }));
                void patchPatientFields({ aperta }, ['aperta']);
              }}
            />
            Aperto (centrale)
          </label>
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

      {mostraTabPma ? (
        <div className="flex gap-1 border-b border-slate-300" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mainTab === 'centrale'}
            className={
              mainTab === 'centrale'
                ? 'border-b-2 border-teal-600 px-4 py-2 text-xs font-bold uppercase text-teal-800'
                : 'px-4 py-2 text-xs font-bold uppercase text-slate-500 hover:text-slate-700'
            }
            onClick={() => setMainTab('centrale')}
          >
            Valutazioni centrale
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mainTab === 'pma'}
            className={
              mainTab === 'pma'
                ? 'border-b-2 border-violet-600 px-4 py-2 text-xs font-bold uppercase text-violet-900'
                : 'px-4 py-2 text-xs font-bold uppercase text-slate-500 hover:text-slate-700'
            }
            onClick={() => setMainTab('pma')}
          >
            PMA
          </button>
        </div>
      ) : null}

      {(!mostraTabPma || mainTab === 'centrale') && (
        <div className="space-y-4">
          {anagraficaCentralePanel}
          {datiCentraleCentralePanel}
        </div>
      )}

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
