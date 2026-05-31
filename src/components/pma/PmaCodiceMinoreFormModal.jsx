import { useEffect, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { Modal } from '../ui/Modal';
import { btnPrimary, btnSecondary } from '../ui/FormField';
import { toDatetimeLocalValue, fromDatetimeLocalValue } from '../../lib/datetimeLocal';
import { codiceMinoreFromPaziente } from '../../services/pmaCodiceMinoreService';
import { isPercorsoCodiceMinoreTrasporto } from '../../lib/pmaDestinazioneTrasporto';
import { useRegistryPartecipanti } from '../../hooks/useRegistryPartecipanti';
import { cercaPerPettorale, etaDaDataNascita } from '../../lib/excelPartecipanti';
import { FormField, inputClass } from '../ui/FormField';
import { Search } from 'lucide-react';

function emptyDraft() {
  return {
    pettorale: '',
    nome: '',
    cognome: '',
    dataNascita: '',
    eta: '',
    motivoArrivo: '',
    trattamento: '',
    oraArrivo: toDatetimeLocalValue(Timestamp.now()),
    oraFine: '',
  };
}

function draftFromRow(row) {
  const cm = codiceMinoreFromPaziente(row);
  const eta =
    cm.eta != null
      ? String(cm.eta)
      : cm.dataNascita
        ? String(etaDaDataNascita(cm.dataNascita) ?? '')
        : '';
  return {
    pettorale: cm.pettorale != null ? String(cm.pettorale) : '',
    nome: cm.nome ?? '',
    cognome: cm.cognome ?? '',
    dataNascita: cm.dataNascita ? String(cm.dataNascita).slice(0, 10) : '',
    eta,
    motivoArrivo: cm.motivoArrivo,
    trattamento: cm.trattamento,
    oraArrivo: toDatetimeLocalValue(cm.oraArrivo),
    oraFine: toDatetimeLocalValue(cm.oraFine),
  };
}

function tsFromLocal(value, fallbackNow = true) {
  const d = fromDatetimeLocalValue(value);
  if (d) return Timestamp.fromDate(d);
  return fallbackNow ? Timestamp.now() : null;
}

export function PmaCodiceMinoreFormModal({
  open,
  row,
  busy,
  impostazioni,
  onClose,
  onSave,
}) {
  const editingId = row?._docId ?? null;
  const daTrasportoCentrale = row ? isPercorsoCodiceMinoreTrasporto(row) : false;
  const [draft, setDraft] = useState(emptyDraft);
  const { registryPartecipanti } = useRegistryPartecipanti(
    impostazioni?.registryPartecipanti ?? [],
  );

  useEffect(() => {
    if (!open) return;
    setDraft(row ? draftFromRow(row) : emptyDraft());
  }, [open, row]);

  if (!open) return null;

  const title = editingId
    ? `Modifica codice minore — ${row?.pettorale ?? row?.idPaziente ?? 'in arrivo'}`
    : 'Nuovo codice minore';

  const patchDraft = (key, value) => setDraft((d) => ({ ...d, [key]: value }));

  const cercaPettoraleInElenco = () => {
    const hit = cercaPerPettorale(registryPartecipanti, draft.pettorale);
    if (!hit) {
      alert(
        'Pettorale non trovato. Carica l’Excel partecipanti in Impostazioni (tab Mezzi e strutture).',
      );
      return;
    }
    setDraft((d) => ({
      ...d,
      nome: hit.nome ?? '',
      cognome: hit.cognome ?? '',
      pettorale: String(hit.pettorale),
      dataNascita: hit.dataNascita ?? '',
      eta: hit.dataNascita ? String(etaDaDataNascita(hit.dataNascita) ?? '') : '',
    }));
  };

  const handleSave = async () => {
    const payload = {
      pettorale: draft.pettorale,
      nome: draft.nome,
      cognome: draft.cognome,
      dataNascita: draft.dataNascita,
      eta: draft.eta !== '' ? Number(draft.eta) : null,
      motivoArrivo: draft.motivoArrivo,
      trattamento: draft.trattamento,
      oraArrivo: tsFromLocal(draft.oraArrivo, true),
      oraFine: draft.oraFine ? tsFromLocal(draft.oraFine, false) : null,
    };
    await onSave(payload, row);
  };

  return (
    <Modal title={title} wide fitViewport onClose={onClose}>
      <div className="space-y-4">
        {daTrasportoCentrale && (
          <p className="text-xs text-slate-600">
            Paziente inviato da centrale: nome, cognome e pettorale possono essere completati in
            astanteria.
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          <FormField label={daTrasportoCentrale ? 'N. pettorale (opzionale)' : 'N. pettorale'}>
            <div className="flex gap-1">
              <input
                type="number"
                min={1}
                inputMode="numeric"
                className={`${inputClass} flex-1`}
                value={draft.pettorale}
                onChange={(e) => patchDraft('pettorale', e.target.value)}
              />
              <button
                type="button"
                title="Compila dall’Excel partecipanti (Impostazioni)"
                className="inline-flex shrink-0 items-center justify-center rounded border border-teal-300 bg-white px-2 text-teal-800 hover:bg-teal-50 disabled:opacity-40"
                disabled={!registryPartecipanti.length || !draft.pettorale}
                onClick={cercaPettoraleInElenco}
              >
                <Search className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </FormField>
          <FormField label="Nome">
            <input
              type="text"
              className={inputClass}
              value={draft.nome}
              onChange={(e) => patchDraft('nome', e.target.value)}
            />
          </FormField>
          <FormField label="Cognome">
            <input
              type="text"
              className={inputClass}
              value={draft.cognome}
              onChange={(e) => patchDraft('cognome', e.target.value)}
            />
          </FormField>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Data di nascita">
            <input
              type="date"
              className={inputClass}
              value={draft.dataNascita}
              onChange={(e) => {
                const dataNascita = e.target.value;
                const nuovaEta =
                  dataNascita && dataNascita.length >= 10 ? etaDaDataNascita(dataNascita) : null;
                setDraft((d) => ({
                  ...d,
                  dataNascita,
                  eta: nuovaEta != null ? String(nuovaEta) : '',
                }));
              }}
            />
          </FormField>
          <FormField label="Età">
            <input
              type="number"
              min={0}
              className={inputClass}
              value={draft.eta}
              onChange={(e) => patchDraft('eta', e.target.value)}
            />
          </FormField>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block min-w-0 text-sm sm:col-span-2">
            <span className="mb-1 block font-medium text-slate-700">Motivo arrivo</span>
            <input
              type="text"
              className={inputClass}
              value={draft.motivoArrivo}
              onChange={(e) => patchDraft('motivoArrivo', e.target.value)}
            />
          </label>
          <label className="block min-w-0 text-sm sm:col-span-2">
            <span className="mb-1 block font-medium text-slate-700">Trattamento</span>
            <textarea
              rows={3}
              className={inputClass}
              value={draft.trattamento}
              onChange={(e) => patchDraft('trattamento', e.target.value)}
            />
          </label>
          <label className="block min-w-0 text-sm">
            <span className="mb-1 block font-medium text-slate-700">Ora arrivo</span>
            <input
              type="datetime-local"
              className={inputClass}
              value={draft.oraArrivo}
              onChange={(e) => patchDraft('oraArrivo', e.target.value)}
            />
          </label>
          <label className="block min-w-0 text-sm">
            <span className="mb-1 block font-medium text-slate-700">Ora fine</span>
            <input
              type="datetime-local"
              className={inputClass}
              value={draft.oraFine}
              onChange={(e) => patchDraft('oraFine', e.target.value)}
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-2">
          <button
            type="button"
            className={btnPrimary}
            disabled={busy}
            onClick={() => void handleSave()}
          >
            {editingId ? 'Salva' : 'Crea'}
          </button>
          <button type="button" className={btnSecondary} disabled={busy} onClick={onClose}>
            Annulla
          </button>
        </div>
      </div>
    </Modal>
  );
}
