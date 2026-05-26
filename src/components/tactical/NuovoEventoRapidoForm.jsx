import { useState } from 'react';
import { DEFAULT_IMPOSTAZIONI } from '../../constants';
import { useManifestazioneId } from '../../context/ManifestazioneContext';
import { dettagliPerTipoEvento } from '../../lib/impostazioniNormalize';
import { useImpostazioni } from '../../hooks/useImpostazioni';
import { createEvento } from '../../services/eventiService';
import { createMissione } from '../../services/missioniService';
import { filterMezziSelezionabiliPerNuovaMissione } from '../../lib/mezzoMissione';
import { ColoreIndicator } from '../ui/ColoreIndicator';
import { ColoreSelectButtons } from '../ui/ColoreSelectButtons';
import { FormField, btnPrimary, btnSecondary, inputClass, selectClass } from '../ui/FormField';

const emptyDraft = () => ({
  luogo_fisico: '',
  colore: 'Bianco',
  codiceColoreMissione: '',
  tipoEvento: DEFAULT_IMPOSTAZIONI.tipiEvento[0],
  dettaglioEvento: '',
  mezzo: '',
});

export function NuovoEventoRapidoForm({
  eventi,
  missioni,
  mezzi,
  onCancel,
  onCreated,
}) {
  const manifestationId = useManifestazioneId();
  const { impostazioni, loading } = useImpostazioni();
  const [draft, setDraft] = useState(emptyDraft);
  const [saving, setSaving] = useState(false);

  if (loading) {
    return <p className="p-2 text-xs text-slate-500">Caricamento…</p>;
  }

  const tipo = draft.tipoEvento ?? impostazioni.tipiEvento[0] ?? '';
  const opzioniDettaglio = dettagliPerTipoEvento(impostazioni, tipo);
  const colori = DEFAULT_IMPOSTAZIONI.coloriEvento;

  const mezziDisponibili = filterMezziSelezionabiliPerNuovaMissione(mezzi, missioni);

  const patch = (fields) => setDraft((d) => ({ ...d, ...fields }));

  const onTipoChange = (nuovoTipo) => {
    const opzioni = dettagliPerTipoEvento(impostazioni, nuovoTipo);
    const dettaglioOk = opzioni.includes(draft.dettaglioEvento);
    patch({
      tipoEvento: nuovoTipo,
      dettaglioEvento: dettaglioOk ? draft.dettaglioEvento : '',
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    const luogo = draft.luogo_fisico.trim();
    if (!luogo) {
      alert('Indica il luogo evento.');
      return;
    }
    if (!draft.mezzo) {
      alert('Seleziona un mezzo per la missione.');
      return;
    }
    const mezzo = mezzi.find((m) => (m.sigla ?? m._docId) === draft.mezzo);
    if (!mezzo) {
      alert('Mezzo non trovato.');
      return;
    }

    setSaving(true);
    try {
      const result = await createEvento(
        manifestationId,
        {
          luogo_fisico: luogo,
          indirizzo: '',
          tipoEvento: draft.tipoEvento,
          dettaglioEvento: draft.dettaglioEvento,
          colore: draft.colore,
          noteEvento: '',
        },
        eventi,
      );
      await createMissione(
        manifestationId,
        {
          eventoIdUnivoco: result.idUnivoco,
          eventoCorrelato: result.idEvento,
          mezzo: draft.mezzo,
          pazienteAutopresentato: false,
          codiceColoreMissione: draft.codiceColoreMissione || undefined,
        },
        missioni,
        mezzo,
      );
      setDraft(emptyDraft());
      onCreated?.(result);
    } catch (err) {
      alert('Errore: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 border-b border-slate-200 bg-slate-50/80 p-3">
      <p className="text-xs font-bold uppercase text-sky-800">Nuovo evento rapido</p>

      <FormField label="Luogo evento">
        <input
          type="text"
          className={inputClass}
          value={draft.luogo_fisico}
          onChange={(e) => patch({ luogo_fisico: e.target.value })}
          placeholder='es. "SETTORE C", "PIT A"'
          required
        />
      </FormField>

      <div>
        <p className="mb-1.5 text-[10px] font-semibold uppercase text-slate-600">Codice colore</p>
        <div className="flex flex-wrap gap-1">
          {colori.map((c) => {
            const sel = draft.colore === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => patch({ colore: c })}
                className={`rounded border-2 p-1 ${
                  sel ? 'border-sky-600 bg-sky-50' : 'border-slate-200 bg-white'
                }`}
                title={c}
              >
                <ColoreIndicator colore={c} size="md" />
              </button>
            );
          })}
        </div>
      </div>

      <FormField label="Tipo evento">
        <select
          className={selectClass}
          value={tipo}
          onChange={(e) => onTipoChange(e.target.value)}
        >
          {impostazioni.tipiEvento.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Dettaglio evento">
        {opzioniDettaglio.length > 0 ? (
          <select
            className={selectClass}
            value={draft.dettaglioEvento}
            onChange={(e) => patch({ dettaglioEvento: e.target.value })}
          >
            <option value="">—</option>
            {opzioniDettaglio.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        ) : (
          <input
            className={inputClass}
            value={draft.dettaglioEvento}
            onChange={(e) => patch({ dettaglioEvento: e.target.value })}
          />
        )}
      </FormField>

      <div className="rounded border border-violet-200 bg-violet-50/60 p-2">
        <p className="mb-2 text-[10px] font-bold uppercase text-violet-900">Missione</p>
        <FormField label="Mezzo">
          <select
            className={selectClass}
            value={draft.mezzo}
            onChange={(e) => patch({ mezzo: e.target.value })}
            required
          >
            <option value="">—</option>
            {mezziDisponibili.map((m) => {
              const s = m.sigla ?? m._docId;
              return (
                <option key={s} value={s}>
                  {s} — {m.tipo}
                </option>
              );
            })}
          </select>
        </FormField>
        <div className="mt-2">
          <p className="mb-1 text-[10px] font-semibold uppercase text-violet-800">
            Codice colore missione
          </p>
          <ColoreSelectButtons
            value={draft.codiceColoreMissione}
            onChange={(c) => patch({ codiceColoreMissione: c ?? '' })}
          />
        </div>
        <p className="mt-1 text-[10px] text-violet-800">
          Viene creata una missione ALLERTARE collegata all&apos;evento. Colore trasporto: dai pazienti.
        </p>
      </div>

      <div className="flex gap-2">
        <button type="submit" className={`${btnPrimary} flex-1 text-xs`} disabled={saving}>
          {saving ? 'Creazione…' : 'Crea evento e missione'}
        </button>
        <button
          type="button"
          className={btnSecondary}
          disabled={saving}
          onClick={onCancel}
        >
          Annulla
        </button>
      </div>
    </form>
  );
}
