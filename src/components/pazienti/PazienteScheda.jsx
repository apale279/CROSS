import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { collection, doc, onSnapshot, Timestamp } from 'firebase/firestore';
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
  STATO_PZ_PMA,
  TIPO_PZ,
  statoPzPmaLabel,
} from '../../lib/pmaModule';
import { chiusuraCentraleLabel, isChiusoCentrale, isTrasportoCentraleModificabile, statoCentraleLabel } from '../../lib/pazienteStati';
import { moduliSchedaPaziente, pmaIdDaPaziente, usaSchedaUnificataPma, VISTA_SCHEDA } from '../../lib/pazienteSchedaModuli';
import { setPazientePmaInArrivo } from '../../services/pazientePmaMissionSync';
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
import { patchMissioneCodiceColoreFromPaziente } from '../../services/missioniService';
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
  missioniEvento,
  allPazienti,
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
  const mezziEvento = useMemo(() => mezziMissioniEvento(missioniEvento), [missioniEvento]);
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

  /** Snapshot diretto sul documento paziente → merge preservando campi dirty. */
  useEffect(() => {
    if (isCreate || !patientDocId || !manifestationId) return undefined;
    const dref = doc(db, ...pazientiPath(manifestationId), patientDocId);
    const unsub = onSnapshot(
      dref,
      (snap) => {
        if (!snap.exists()) return;
        const row = { _docId: snap.id, ...snap.data() };
        setServerPatient(row);
        setDraft((prev) =>
          mergePatientDraftFromServer(prev, row, dirtyPatientFieldsRef.current),
        );
      },
      () => {},
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
    const mis = missioniEvento.find((m) => {
      if (m.mezzo !== displayPatient.mezzo || m.stato !== 'ARRIVATO H') return false;
      if (displayPatient.missioneIdUnivoco) {
        return m.idUnivoco === displayPatient.missioneIdUnivoco;
      }
      return true;
    });
    if (!mis) return;
    void transitionPazienteArrivatoHTransaction(manifestationId, patientDocId, evento);
  }, [missioniEvento, displayPatient, isCreate, manifestationId, patientDocId, evento]);

  const patchPatientFields = useCallback(
    async (fields, dirtyKeysToClear = []) => {
      if (!fields || Object.keys(fields).length === 0) return;
      if (isCreate) {
        setDraft((d) => ({ ...d, ...fields }));
        return;
      }
      await patchPaziente(manifestationId, patientDocId, fields);
      dirtyKeysToClear.forEach((k) => dirtyPatientFieldsRef.current.delete(k));
    },
    [isCreate, manifestationId, patientDocId],
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
      ['ospedaleDestinazione', 'destinazionePmaId', 'pmaId', ...Object.keys(soreuInit)].forEach(
        touchDirty,
      );
      setDraft((d) => ({ ...d, ...patch }));
      if (isCreate) return;
      await patchPatientFields(patch, Object.keys(patch));
      if (dest.destinazionePmaId && patientDocId) {
        await setPazientePmaInArrivo(
          manifestationId,
          patientDocId,
          { ...displayPatient, ...patch },
          evento,
        );
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
      patchPatientFields,
      touchDirty,
    ],
  );

  useEffect(() => {
    if (isCreate && !draft.creatoLocal) {
      setDraft((d) => ({ ...d, creatoLocal: toDatetimeLocalValue(new Date()) }));
    }
  }, [isCreate, draft.creatoLocal]);

  const isOriginePma = !isCreate && isPazienteOriginePma(displayPatient);
  const moduli = !isCreate && displayPatient ? moduliSchedaPaziente(displayPatient) : null;
  const pmaIdScheda = displayPatient ? pmaIdDaPaziente(displayPatient) : '';
  const schedaUnificataPma = !isCreate && usaSchedaUnificataPma(displayPatient);

  const trasporta = draft.esito === ESITO_TRASPORTA;
  const trasportoModificabile = isCreate || isTrasportoCentraleModificabile(displayPatient);
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
  };

  const onEsitoChange = async (esito) => {
    if (displayPatient && !isTrasportoCentraleModificabile(displayPatient)) return;
    const clearTrasporto = esito !== ESITO_TRASPORTA;
    const fields = fieldsPerEsito(esito, { clearTrasporto });
    const soreuKeys = [
      'esito',
      'mezzo',
      'stato',
      'ospedaleDestinazione',
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
    const mis = missionePerMezzo(missioniEvento, mezzo);
    const fields = fieldsPerEsito(ESITO_TRASPORTA, { mezzo, missione: mis });
    ['mezzo', 'stato', 'ospedaleDestinazione'].forEach(touchDirty);
    setDraft((d) => ({ ...d, ...fields }));
    if (!isCreate) {
      await patchPatientFields(fields, ['mezzo', 'stato', 'ospedaleDestinazione']);
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
      const mis = missionePerMezzo(missioniEvento, draft.mezzo);
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
        allPazienti,
      );
      onSaved?.();
      onClose?.();
    } catch (err) {
      alert('Errore: ' + err.message);
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
    await patchPatientFields({ apertura: date ? Timestamp.fromDate(date) : null }, [
      'creatoLocal',
    ]);
  };

  const anagraficaCentralePanel = schedaUnificataPma ? (
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
  ) : null;

  const datiCentraleCentralePanel =
    schedaUnificataPma && !isOriginePma ? (
      <div className="space-y-4 p-1">
        <dl className="grid gap-3 md:grid-cols-2">
          <FormField label="Evento correlato">
            <p className="font-mono font-semibold text-slate-800">{evento?.idEvento ?? '—'}</p>
          </FormField>
          {displayPatient?.idMissione && (
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
          {displayPatient?.stato === 'ARRIVATO H' && (
            <FormField label="Arrivato in H">
              <p className="text-slate-800">{formatTimestamp(displayPatient.arrivatoHAt)}</p>
            </FormField>
          )}
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
        </dl>
        {moduli?.esitoTrasporto && (
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

  return (
    <div className="space-y-4 text-sm">
      {!isCreate && displayPatient && (
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 pb-3">
          <span className="font-mono text-xl font-bold text-teal-800">
            {displayPatient.idPaziente}
          </span>
          <span className="font-mono text-xs text-slate-500">{displayPatient.idUnivoco}</span>
          {moduli?.haPma && pmaIdScheda && !schedaUnificataPma && (
            <a
              href={`#modulo-pma`}
              className="rounded border border-violet-400 bg-violet-50 px-3 py-1.5 text-xs font-bold uppercase text-violet-900 hover:bg-violet-100"
            >
              Vai al modulo PMA ↓
            </a>
          )}
          {!isOriginePma && displayPatient?.stato !== 'ARRIVATO H' && !isChiusoCentrale(displayPatient) && (
          <label className="ml-auto flex items-center gap-2">
            <input
              type="checkbox"
              checked={draft.aperta}
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

      {schedaUnificataPma ? (
        <PazienteModuloPma
          patientDocId={patientDocId}
          pmaId={pmaIdScheda}
          eventi={eventiAll}
          evento={evento}
          missioniEvento={missioniEvento}
          vistaScheda={VISTA_SCHEDA.CENTRALE}
          defaultTab="cartella"
          anagraficaPanel={anagraficaCentralePanel}
          datiCentralePanel={datiCentraleCentralePanel}
        />
      ) : (
        <>
      {!isOriginePma && (
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
      </dl>
      )}

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

      <div className="border-t border-slate-200 pt-3">
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
            if (isCreate) return;
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

      {!isOriginePma && (isCreate || moduli?.esitoTrasporto) && (
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
                onBlur={(e) =>
                  !isCreate &&
                  patchPatientFields({ esitoAltro: e.target.value }, ['esitoAltro'])
                }
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
                    if (!isCreate) void patchPatientFields(partial, Object.keys(partial));
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
        </>
      )}

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
