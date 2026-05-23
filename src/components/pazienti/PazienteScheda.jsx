import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { collection, doc, onSnapshot, Timestamp } from 'firebase/firestore';
import { Search, Trash2 } from 'lucide-react';
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
  findPmaById,
} from '../../lib/destinazioniOspedale';
import { TIPO_PZ } from '../../lib/pmaModule';
import { PmaPazientePanel } from './PmaPazientePanel';
import {
  pazientiPath,
  pazienteValutazioniSoccorsoPathSegments,
} from '../../lib/firestorePaths';
import { toDatetimeLocalValue, fromDatetimeLocalValue } from '../../lib/datetimeLocal';
import {
  fieldsPerEsito,
  mezziMissioniEvento,
  missionePerMezzo,
} from '../../lib/pazienteRules';
import {
  createPaziente,
  migrateLegacyValutazioniIfNeeded,
  patchPaziente,
  setValutazioneSoccorsoDoc,
  updateValutazioneSoccorsoDoc,
  deleteValutazioneSoccorsoDoc,
  transitionPazienteArrivatoHTransaction,
} from '../../services/pazientiService';
import { patchMissioneCodiceColoreFromPaziente } from '../../services/missioniService';
import { formatTimestamp } from '../../utils/formatters';
import { FormField, btnPrimary, btnSecondary, inputClass, selectClass } from '../ui/FormField';
import { MsbValutazioneForm } from './MsbValutazioneForm';
import { ValutazioneMezzoButtons } from './ValutazioneMezzoButtons';
import { SoreuTrasportoFields } from './SoreuTrasportoFields';
import {
  defaultSoreuOraMissione,
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

  const pmaDestNome = useMemo(() => {
    const id = displayPatient?.destinazionePmaId ?? draft.destinazionePmaId;
    return findPmaById(impostazioni, id)?.nome ?? null;
  }, [displayPatient?.destinazionePmaId, draft.destinazionePmaId, impostazioni]);

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
    const mis = missioniEvento.find(
      (m) =>
        m.mezzo === displayPatient.mezzo &&
        m.stato === 'ARRIVATO H' &&
        displayPatient.mezzo,
    );
    if (!mis) return;
    void transitionPazienteArrivatoHTransaction(manifestationId, patientDocId);
  }, [missioniEvento, displayPatient, isCreate, manifestationId, patientDocId]);

  useEffect(() => {
    if (isCreate && !draft.creatoLocal) {
      setDraft((d) => ({ ...d, creatoLocal: toDatetimeLocalValue(new Date()) }));
    }
  }, [isCreate, draft.creatoLocal]);

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

  const trasporta = draft.esito === ESITO_TRASPORTA;
  const showAltro = draft.esito === ESITO_ALTRO;

  const valutazioniList = useMemo(
    () =>
      isCreate
        ? normalizeValutazioniSoccorso(draft.valutazioniSoccorso ?? [])
        : valuationRows,
    [isCreate, draft.valutazioniSoccorso, valuationRows],
  );

  const addValutazione = async (tipo) => {
    const item = {
      id: crypto.randomUUID(),
      tipo,
      testo: '',
      msbDetails: tipo === 'MSB' ? emptyMsbDetails() : null,
      msaDetails: tipo === 'MSA' ? emptyMsaDetails() : null,
      mezzo: '',
      creatoIl: Timestamp.now(),
    };
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
    await updateValutazioneSoccorsoDoc(manifestationId, patientDocId, id, {
      msbDetails: merged,
    });
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
    await updateValutazioneSoccorsoDoc(manifestationId, patientDocId, id, {
      msaDetails: merged,
      mezzo: merged.mezzoMsa ?? row.mezzo ?? '',
    });
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
    const mis = missionePerMezzo(missioniEvento, mezzo);
    const fields = fieldsPerEsito(ESITO_TRASPORTA, { mezzo, missione: mis });
    ['mezzo', 'stato', 'ospedaleDestinazione'].forEach(touchDirty);
    setDraft((d) => ({ ...d, ...fields }));
    if (!isCreate) {
      await patchPatientFields(fields, ['mezzo', 'stato', 'ospedaleDestinazione']);
    }
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      const creato = fromDatetimeLocalValue(draft.creatoLocal);
      const mis = missionePerMezzo(missioniEvento, draft.mezzo);
      await createPaziente(
        manifestationId,
        {
          eventoIdUnivoco: evento.idUnivoco,
          eventoCorrelato: evento.idEvento,
          aperta: draft.aperta,
          apertura: creato ? Timestamp.fromDate(creato) : undefined,
          esito: draft.esito,
          esitoAltro: showAltro ? draft.esitoAltro : '',
          ospedaleDestinazione: trasporta ? draft.ospedaleDestinazione : '',
          destinazionePmaId: trasporta ? draft.destinazionePmaId ?? '' : '',
          pmaId: trasporta ? draft.destinazionePmaId ?? '' : '',
          tipoPz: TIPO_PZ.CENTRALE,
          statoPzPma: null,
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

  return (
    <div className="space-y-4 text-sm">
      {!isCreate && displayPatient && (
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 pb-3">
          <span className="font-mono text-xl font-bold text-teal-800">
            {displayPatient.idPaziente}
          </span>
          <span className="font-mono text-xs text-slate-500">{displayPatient.idUnivoco}</span>
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
            Aperto
          </label>
        </div>
      )}

      <dl className="grid gap-3 md:grid-cols-2">
        <FormField label="Evento correlato">
          <p className="font-mono font-semibold text-slate-800">{evento.idEvento}</p>
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

      <div className="border-t border-slate-200 pt-3">
        <p className="mb-2 text-xs font-bold uppercase text-slate-600">Anagrafica</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Pettorale">
            <div className="flex gap-1">
              <input
                type="number"
                min={1}
                className={`${inputClass} flex-1`}
                value={draft.pettorale}
                placeholder="Nr."
                onChange={(e) => {
                  touchDirty('pettorale');
                  setDraft((d) => ({ ...d, pettorale: e.target.value }));
                }}
                onBlur={() =>
                  !isCreate &&
                  patchPatientFields(
                    {
                      pettorale:
                        draft.pettorale !== '' && draft.pettorale != null
                          ? Number(draft.pettorale)
                          : null,
                    },
                    ['pettorale'],
                  )
                }
              />
              <button
                type="button"
                title="Compila dall’Excel partecipanti (Impostazioni)"
                className="inline-flex shrink-0 items-center justify-center rounded border border-teal-300 bg-white px-2 text-teal-800 hover:bg-teal-50 disabled:opacity-40"
                disabled={!draft.pettorale || String(draft.pettorale).trim() === ''}
                onClick={() => void cercaPettoraleInElenco()}
              >
                <Search className="h-4 w-4" aria-hidden />
                <span className="sr-only">Cerca nel registro pettorali</span>
              </button>
            </div>
          </FormField>
          <FormField label="Nome">
            <input
              className={inputClass}
              value={draft.nome}
              onChange={(e) => {
                touchDirty('nome');
                setDraft((d) => ({ ...d, nome: e.target.value }));
              }}
              onBlur={() => !isCreate && patchPatientFields({ nome: draft.nome }, ['nome'])}
            />
          </FormField>
          <FormField label="Cognome">
            <input
              className={inputClass}
              value={draft.cognome}
              onChange={(e) => {
                touchDirty('cognome');
                setDraft((d) => ({ ...d, cognome: e.target.value }));
              }}
              onBlur={() =>
                !isCreate && patchPatientFields({ cognome: draft.cognome }, ['cognome'])
              }
            />
          </FormField>
          <FormField label="Data di nascita">
            <input
              type="date"
              className={inputClass}
              value={draft.dataNascita ? draft.dataNascita.slice(0, 10) : ''}
              onChange={(e) => {
                touchDirty('dataNascita');
                const dataNascita = e.target.value;
                setDraft((d) => {
                  const nuovaEta =
                    dataNascita && dataNascita.length >= 10 ? etaDaDataNascita(dataNascita) : null;
                  return {
                    ...d,
                    dataNascita,
                    eta: nuovaEta != null ? String(nuovaEta) : d.eta,
                  };
                });
              }}
              onBlur={(e) =>
                !isCreate &&
                patchPatientFields(
                  {
                    dataNascita: e.target.value,
                    eta: etaDaDataNascita(e.target.value),
                  },
                  ['dataNascita', 'eta'],
                )
              }
            />
          </FormField>
          <FormField label="Telefono">
            <input
              type="tel"
              className={inputClass}
              value={draft.telefono}
              onChange={(e) => {
                touchDirty('telefono');
                setDraft((d) => ({ ...d, telefono: e.target.value }));
              }}
              onBlur={() =>
                !isCreate && patchPatientFields({ telefono: draft.telefono }, ['telefono'])
              }
            />
          </FormField>
          <FormField label="Età">
            <input
              type="number"
              className={inputClass}
              value={draft.eta}
              onChange={(e) => {
                touchDirty('eta');
                setDraft((d) => ({ ...d, eta: e.target.value }));
              }}
              onBlur={() =>
                !isCreate && patchPatientFields({ eta: parseEtaDraft(draft.eta) }, ['eta'])
              }
            />
          </FormField>
          <FormField label="Sesso">
            <select
              className={selectClass}
              value={draft.sesso}
              onChange={(e) => {
                touchDirty('sesso');
                const sesso = e.target.value;
                setDraft((d) => ({ ...d, sesso }));
                void patchPatientFields({ sesso }, ['sesso']);
              }}
            >
              <option value="">—</option>
              <option value="M">M</option>
              <option value="F">F</option>
              <option value="Altro">Altro</option>
            </select>
          </FormField>
          <FormField label="Note" className="sm:col-span-2">
            <textarea
              className={inputClass}
              rows={2}
              value={draft.notePaziente}
              onChange={(e) => {
                touchDirty('notePaziente');
                setDraft((d) => ({ ...d, notePaziente: e.target.value }));
              }}
              onBlur={() =>
                !isCreate &&
                patchPatientFields({ notePaziente: draft.notePaziente }, ['notePaziente'])
              }
            />
          </FormField>
        </div>
      </div>

      <div className="border-t border-slate-200 pt-3">
        <p className="mb-2 text-xs font-bold uppercase text-slate-600">Esito e trasporto</p>
        <div className="mb-4 space-y-3">
          <FormField label="Esito">
            <select
              className={selectClass}
              value={draft.esito}
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
                  onChange={(e) => {
                    const dest = resolveDestinazionePaziente(e.target.value, impostazioni);
                    const soreuInit =
                      dest.ospedaleDestinazione && !draft.soreuOraMissione
                        ? { soreuOraMissione: defaultSoreuOraMissione() }
                        : {};
                    const patch = { ...dest, ...soreuInit };
                    ['ospedaleDestinazione', 'destinazionePmaId', ...Object.keys(soreuInit)].forEach(
                      touchDirty,
                    );
                    setDraft((d) => ({ ...d, ...patch }));
                    void patchPatientFields(patch, Object.keys(patch));
                  }}
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
              {draft.ospedaleDestinazione && (
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
              <PmaPazientePanel paziente={displayPatient ?? draft} pmaNome={pmaDestNome} />
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
                    msbDetails={v.msbDetails}
                    mezziEventoSigle={mezziEvento}
                    onPatch={(partial) => void patchMsbValutazione(v.id, partial)}
                  />
                ) : (
                  <MsaValutazioneForm
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
