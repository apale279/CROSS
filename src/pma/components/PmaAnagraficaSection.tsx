import { useEffect, useState } from 'react';
import type { Paziente } from '@pma/types/paziente';
import { CODICE_COLORE_LABEL, type CodiceColorePaziente } from '@pma/types/paziente';
import { opToolbarBtnSm } from '@pma/cross/operativeTokens';
import { PmaFieldGuard } from './PmaFieldGuard';

const CODICI: CodiceColorePaziente[] = ['bianco', 'verde', 'giallo', 'rosso'];

function pillCodice(c: CodiceColorePaziente, on: boolean) {
  if (c === 'bianco') return `pma-pill ${on ? 'pma-pill--bianco-on' : 'pma-pill--bianco-off'}`;
  if (c === 'verde') return `pma-pill ${on ? 'pma-pill--verde-on' : 'pma-pill--verde-off'}`;
  if (c === 'giallo') return `pma-pill ${on ? 'pma-pill--giallo-on' : 'pma-pill--giallo-off'}`;
  return `pma-pill ${on ? 'pma-pill--rosso-on' : 'pma-pill--rosso-off'}`;
}

type Props = {
  p: Paziente;
  canEdit: boolean;
  centraleReadonly: boolean;
  write: (patch: Record<string, unknown>) => Promise<void>;
};

export function PmaAnagraficaSection({ p, canEdit, centraleReadonly, write }: Props) {
  const [draft, setDraft] = useState({
    nome: p.nome,
    cognome: p.cognome,
    pettorale: p.pettorale ?? '',
    telefono: p.telefono,
    note: p.note_centrale ?? '',
    breve: p.breve_descrizione ?? '',
  });

  useEffect(() => {
    setDraft({
      nome: p.nome,
      cognome: p.cognome,
      pettorale: p.pettorale ?? '',
      telefono: p.telefono,
      note: p.note_centrale ?? '',
      breve: p.breve_descrizione ?? '',
    });
  }, [p.id]);

  const anagraficaLocked = centraleReadonly || !canEdit;

  const saveAnagrafica = async () => {
    await write({
      nome: draft.nome.trim(),
      cognome: draft.cognome.trim(),
      pettorale: draft.pettorale === '' ? null : Number(draft.pettorale),
      telefono: draft.telefono.trim(),
      note_centrale: draft.note.trim(),
      breve_descrizione: draft.breve.trim(),
    });
  };

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      {centraleReadonly && (
        <p className="rounded bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Paziente inviato dalla centrale: anagrafica di base in sola lettura. Puoi modificare cartella
          clinica e dimissione.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <PmaFieldGuard fieldKey="cognome" className="block">
        <label className="block text-xs font-bold uppercase text-slate-600">
          Cognome
          <input
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-100"
            value={draft.cognome}
            disabled={anagraficaLocked}
            onChange={(e) => setDraft((d) => ({ ...d, cognome: e.target.value }))}
          />
        </label>
        </PmaFieldGuard>
        <PmaFieldGuard fieldKey="nome" className="block">
        <label className="block text-xs font-bold uppercase text-slate-600">
          Nome
          <input
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-100"
            value={draft.nome}
            disabled={anagraficaLocked}
            onChange={(e) => setDraft((d) => ({ ...d, nome: e.target.value }))}
          />
        </label>
        </PmaFieldGuard>
        <PmaFieldGuard fieldKey="pettorale" className="block">
        <label className="block text-xs font-bold uppercase text-slate-600">
          Pettorale
          <input
            type="number"
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-100"
            value={draft.pettorale}
            disabled={anagraficaLocked}
            onChange={(e) => setDraft((d) => ({ ...d, pettorale: e.target.value }))}
          />
        </label>
        </PmaFieldGuard>
        <PmaFieldGuard fieldKey="telefono" className="block">
        <label className="block text-xs font-bold uppercase text-slate-600">
          Telefono
          <input
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-100"
            value={draft.telefono}
            disabled={anagraficaLocked}
            onChange={(e) => setDraft((d) => ({ ...d, telefono: e.target.value }))}
          />
        </label>
        </PmaFieldGuard>
      </div>

      <PmaFieldGuard fieldKey="breve_descrizione">
      <label className="block text-xs font-bold uppercase text-slate-600">
        Breve descrizione
        <textarea
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-100"
          rows={2}
          value={draft.breve}
          disabled={!canEdit}
          onChange={(e) => setDraft((d) => ({ ...d, breve: e.target.value }))}
          onBlur={() => void write({ breve_descrizione: draft.breve.trim() })}
        />
      </label>
      </PmaFieldGuard>

      {!anagraficaLocked && (
        <button type="button" className={opToolbarBtnSm} onClick={() => void saveAnagrafica()}>
          Salva anagrafica
        </button>
      )}

      <PmaFieldGuard fieldKey="codice_colore">
      <div>
        <p className="mb-2 text-xs font-bold uppercase text-slate-600">Codice colore</p>
        <div className="pma-pills flex flex-wrap gap-2">
          {CODICI.map((c) => (
            <button
              key={c}
              type="button"
              disabled={!canEdit}
              className={`${pillCodice(c, p.codice_colore === c)} pma-theme-skip`}
              onClick={() => void write({ codice_colore: c })}
            >
              {CODICE_COLORE_LABEL[c]}
            </button>
          ))}
        </div>
      </div>
      </PmaFieldGuard>

      {p.cross_dati_scheda && (
        <div className="rounded border border-slate-200 bg-slate-50 p-3">
          <p className="mb-1 text-xs font-bold uppercase text-slate-600">Dati da centrale CROSS</p>
          <pre className="whitespace-pre-wrap text-xs text-slate-700">{p.cross_dati_scheda}</pre>
        </div>
      )}
    </div>
  );
}
