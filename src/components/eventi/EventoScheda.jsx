import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { DEFAULT_IMPOSTAZIONI } from '../../constants';
import { useImpostazioni } from '../../hooks/useImpostazioni';
import { useManifestazioneId } from '../../context/ManifestazioneContext';
import { closeEventoForzato, createEvento, deleteEvento, patchEvento } from '../../services/eventiService';
import { EVENTO_TIPO_CHIUSURA } from '../../lib/missionEccezioni';
import { missioniPerEvento, pazientiPerEvento } from '../../lib/eventoLinks';
import { shouldAutoCloseEvento } from '../../utils/eventoAutoClose';
import { confirmDelete } from '../../utils/confirmDelete';
import { buildStatoChangeFields } from '../../lib/missionStoricoStati';
import { createMissione, patchMissione } from '../../services/missioniService';
import { PazienteScheda } from '../pazienti/PazienteScheda';
import { Modal } from '../ui/Modal';
import { coloreBadgeClass, formatTimestamp, statoMissioneBadgeClass } from '../../utils/formatters';
import {
  FormField,
  btnDanger,
  btnPrimary,
  btnSecondary,
  inputClass,
  selectClass,
} from '../ui/FormField';
import { EventoDettaglioForm } from './EventoDettaglioForm';
import { EventoPiantinaUpload } from './EventoPiantinaUpload';

const emptyValues = () => ({
  tipoEvento: DEFAULT_IMPOSTAZIONI.tipiEvento[0],
  dettaglioEvento: '',
  colore: 'Bianco',
  indirizzo: '',
  luogo_fisico: '',
  coordinate: null,
  noteEvento: '',
});

export function EventoScheda({
  evento,
  missioni,
  pazienti,
  mezzi,
  allMissioni,
  allPazienti,
  existingEventi,
  onCreated,
  onDeleted,
}) {
  const isCreate = !evento;
  const manifestazioneId = useManifestazioneId();
  const { impostazioni } = useImpostazioni();

  const [tab, setTab] = useState('dettaglio');
  const [draft, setDraft] = useState(emptyValues);
  const [showMissioneForm, setShowMissioneForm] = useState(false);
  const [pazienteModal, setPazienteModal] = useState(null);
  const [missioneForm, setMissioneForm] = useState({ mezzo: '', pazienteAutopresentato: false });
  const [saving, setSaving] = useState(false);
  const [noteChiusura, setNoteChiusura] = useState('');
  const [chiusuraStandDown, setChiusuraStandDown] = useState(false);
  const [showCloseForm, setShowCloseForm] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (isCreate) {
      setDraft({
        ...emptyValues(),
        tipoEvento: impostazioni.tipiEvento[0] ?? emptyValues().tipoEvento,
      });
      return;
    }
    setDraft({
      tipoEvento: evento.tipoEvento ?? '',
      dettaglioEvento: evento.dettaglioEvento ?? '',
      colore: evento.colore ?? 'Bianco',
      indirizzo: evento.indirizzo ?? '',
      luogo_fisico: evento.luogo_fisico ?? '',
      coordinate: evento.coordinate ?? null,
      noteEvento: evento.noteEvento ?? '',
    });
    setNoteChiusura('');
    setChiusuraStandDown(false);
    setShowCloseForm(false);
  }, [evento, isCreate, impostazioni.tipiEvento]);

  const missioniEvento = useMemo(
    () => (evento ? missioniPerEvento(missioni, evento) : []),
    [missioni, evento],
  );
  const pazientiEvento = useMemo(
    () => (evento ? pazientiPerEvento(pazienti, evento) : []),
    [pazienti, evento],
  );
  const mezziDisponibili = mezzi.filter(
    (m) => (m.statoMezzo ?? 'Disponibile') === 'Disponibile',
  );
  const eventoAperto = isCreate || evento.stato !== false;

  useEffect(() => {
    if (isCreate || !evento?._docId || evento.stato === false) return;
    if (!shouldAutoCloseEvento(missioniEvento)) return;
    patchEvento(manifestazioneId, evento._docId, { stato: false });
  }, [isCreate, evento, missioniEvento, manifestazioneId]);

  const patch = (fields) => {
    if (isCreate) {
      setDraft((d) => ({ ...d, ...fields }));
      return;
    }
    patchEvento(manifestazioneId, evento._docId, fields);
  };

  const commitLocation = (loc) => {
    if (isCreate) {
      setDraft((d) => ({ ...d, ...loc }));
      return;
    }
    patchEvento(manifestazioneId, evento._docId, loc);
  };

  const handleCreaEvento = async () => {
    setSaving(true);
    try {
      const result = await createEvento(manifestazioneId, draft, existingEventi);
      onCreated?.(result);
    } catch (err) {
      alert('Errore: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleNuovaMissione = async (e) => {
    e.preventDefault();
    if (!missioneForm.mezzo) return;
    const mezzo = mezzi.find((m) => (m.sigla ?? m._docId) === missioneForm.mezzo);
    setSaving(true);
    try {
      await createMissione(
        manifestazioneId,
        {
          eventoIdUnivoco: evento.idUnivoco,
          eventoCorrelato: evento.idEvento,
          mezzo: missioneForm.mezzo,
          pazienteAutopresentato: missioneForm.pazienteAutopresentato,
        },
        allMissioni,
        mezzo,
      );
      setMissioneForm({ mezzo: '', pazienteAutopresentato: false });
      setShowMissioneForm(false);
    } catch (err) {
      alert('Errore: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const changeStatoMissione = async (missione, nuovoStato) => {
    await patchMissione(
      manifestazioneId,
      missione._docId,
      buildStatoChangeFields(missione, nuovoStato),
      missione.mezzo,
    );
  };

  const handleChiudiEvento = async () => {
    const note = noteChiusura.trim();
    if (!note) {
      alert('La nota di chiusura ? obbligatoria: indica il motivo della chiusura forzata.');
      return;
    }
    const missioniAperte = missioniEvento.filter(
      (m) =>
        m.aperta !== false &&
        m.stato !== 'FINE MISSIONE' &&
        m.stato !== 'ANNULLATA',
    );
    const msg =
      missioniAperte.length > 0
        ? `Chiudere l'evento ${evento.idEvento}? Verranno chiuse ${missioniAperte.length} missione/i aperte e i mezzi torneranno disponibili.`
        : `Chiudere l'evento ${evento.idEvento}?`;
    if (!window.confirm(msg)) return;

    setClosing(true);
    try {
      await closeEventoForzato(
        manifestazioneId,
        evento._docId,
        missioniEvento,
        note,
        chiusuraStandDown ? EVENTO_TIPO_CHIUSURA.STAND_DOWN : EVENTO_TIPO_CHIUSURA.OPERATORE,
      );
      setShowCloseForm(false);
      setNoteChiusura('');
      setChiusuraStandDown(false);
    } catch (err) {
      alert('Errore: ' + err.message);
    } finally {
      setClosing(false);
    }
  };

  const tabs = isCreate
    ? [{ id: 'dettaglio', label: 'Dettaglio' }]
    : [
        { id: 'dettaglio', label: 'Dettaglio' },
        { id: 'missioni', label: `Missioni (${missioniEvento.length})` },
        { id: 'pazienti', label: `Pazienti (${pazientiEvento.length})` },
        { id: 'impostazioni', label: 'Impostazioni evento' },
      ];

  return (
    <div className="space-y-4">
      {!isCreate && (
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 pb-3">
          <span
            className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${coloreBadgeClass(evento.colore)}`}
          >
            {evento.colore}
          </span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              eventoAperto ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
            }`}
          >
            {eventoAperto ? 'Aperto' : 'Chiuso'}
          </span>
          <span className="text-xs text-slate-500">
            {formatTimestamp(evento.apertura)}
          </span>
          {!eventoAperto && evento.chiusuraIl && (
            <span className="text-xs text-slate-500">
              Chiuso: {formatTimestamp(evento.chiusuraIl)}
            </span>
          )}
          <button
            type="button"
            className={`${btnDanger} ml-auto`}
            onClick={async () => {
              if (!confirmDelete(`evento ${evento.idEvento}`)) return;
              await deleteEvento(manifestazioneId, evento._docId);
              onDeleted?.();
            }}
          >
            Elimina evento
          </button>
        </div>
      )}

      <nav className="flex gap-1 border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`border-b-2 px-4 py-2 text-sm font-medium ${
              tab === t.id
                ? 'border-sky-600 text-sky-700'
                : 'border-transparent text-slate-500'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'dettaglio' && (
        <div>
          <EventoDettaglioForm
            values={draft}
            onPatch={patch}
            onCommitLocation={commitLocation}
            readOnlyId={evento?.idEvento}
          />
          {isCreate && (
            <div className="mt-4">
              <button
                type="button"
                className={btnPrimary}
                disabled={saving}
                onClick={handleCreaEvento}
              >
                {saving ? 'Salvataggio?' : 'Crea evento'}
              </button>
            </div>
          )}
        </div>
      )}

      {!isCreate && tab === 'impostazioni' && (
        <div className="space-y-4">
          <EventoPiantinaUpload evento={evento} />
        </div>
      )}

      {!isCreate && tab === 'missioni' && (
        <div className="space-y-3">
          {eventoAperto && (
            <button
              type="button"
              className={`${btnPrimary} flex items-center gap-2`}
              onClick={() => setShowMissioneForm((v) => !v)}
            >
              <Plus className="h-4 w-4" />
              Nuova missione
            </button>
          )}
          {showMissioneForm && eventoAperto && (
            <form
              onSubmit={handleNuovaMissione}
              className="rounded-lg border border-violet-200 bg-violet-50/50 p-4"
            >
              <FormField label="Mezzo">
                <select
                  className={selectClass}
                  value={missioneForm.mezzo}
                  onChange={(e) =>
                    setMissioneForm((f) => ({ ...f, mezzo: e.target.value }))
                  }
                  required
                >
                  <option value="">?</option>
                  {mezziDisponibili.map((m) => {
                    const s = m.sigla ?? m._docId;
                    return (
                      <option key={s} value={s}>
                        {`${s} ? ${m.tipo}`}
                      </option>
                    );
                  })}
                </select>
              </FormField>
              <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={missioneForm.pazienteAutopresentato}
                  onChange={(e) =>
                    setMissioneForm((f) => ({
                      ...f,
                      pazienteAutopresentato: e.target.checked,
                    }))
                  }
                />
                Paziente autopresentato (stato missione iniziale: IN POSTO)
              </label>
              <div className="mt-3 flex gap-2">
                <button type="submit" className={btnPrimary} disabled={saving}>
                  Invia
                </button>
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => setShowMissioneForm(false)}
                >
                  Annulla
                </button>
              </div>
            </form>
          )}
          {missioniEvento.length > 0 && (
            <ul className="space-y-2">
              {missioniEvento.map((mis) => (
                <li
                  key={mis._docId}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-bold text-violet-700">
                      {mis.idMissione}
                    </span>
                    <span className="font-mono">{mis.mezzo}</span>
                  </div>
                  <select
                    className={`${selectClass} mt-2`}
                    value={mis.stato ?? 'ALLERTARE'}
                    disabled={mis.aperta === false}
                    onChange={(e) => changeStatoMissione(mis, e.target.value)}
                  >
                    {DEFAULT_IMPOSTAZIONI.statiMissione.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <span
                    className={`mt-2 inline-block rounded border px-2 py-0.5 text-xs font-bold uppercase ${statoMissioneBadgeClass(mis.stato)}`}
                  >
                    {mis.stato}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!isCreate && tab === 'pazienti' && (
        <div className="space-y-3">
          {eventoAperto && (
            <button
              type="button"
              className={`${btnPrimary} flex items-center gap-2`}
              onClick={() => setPazienteModal({ create: true })}
            >
              <Plus className="h-4 w-4" />
              Nuovo paziente
            </button>
          )}
          {pazientiEvento.length > 0 && (
            <ul className="space-y-2">
              {pazientiEvento.map((paz) => (
                <li key={paz._docId}>
                  <button
                    type="button"
                    onClick={() => setPazienteModal({ paziente: paz })}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-left text-sm hover:border-teal-400 hover:bg-teal-50/50"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-teal-700">{paz.idPaziente}</span>
                      <span>
                        {[paz.cognome, paz.nome].filter(Boolean).join(' ') || '?'}
                      </span>
                      {paz.esito && (
                        <span className="rounded bg-slate-200 px-1.5 py-0.5 text-xs">{paz.esito}</span>
                      )}
                      {paz.stato && (
                        <span className="rounded bg-teal-100 px-1.5 py-0.5 text-xs font-medium text-teal-900">
                          {paz.stato}
                        </span>
                      )}
                      {paz.aperta === false && (
                        <span className="text-xs text-slate-500">Chiuso</span>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {pazienteModal && (
        <Modal
          title={
            pazienteModal.create
              ? `Nuovo paziente - ${evento.idEvento}`
              : `Paziente ${pazienteModal.paziente?.idPaziente ?? ''}`
          }
          onClose={() => setPazienteModal(null)}
          wide
        >
          <PazienteScheda
            evento={evento}
            paziente={pazienteModal.create ? null : pazienteModal.paziente}
            missioniEvento={missioniEvento}
            allPazienti={allPazienti}
            onClose={() => setPazienteModal(null)}
          />
        </Modal>
      )}

      {!isCreate && (
        <div className="mt-6 border-t border-slate-200 pt-4">
          {eventoAperto ? (
            <>
              {!showCloseForm ? (
                <button
                  type="button"
                  className={btnDanger}
                  onClick={() => setShowCloseForm(true)}
                >
                  Chiudi evento
                </button>
              ) : (
                <div className="space-y-3 rounded-lg border border-red-200 bg-red-50/60 p-4">
                  <p className="text-sm text-red-900">
                    Chiusura forzata: tutte le missioni dell&apos;evento ancora aperte passeranno a{' '}
                    <strong>FINE MISSIONE</strong> e i mezzi torneranno disponibili (salvo missioni gia
                    annullate o mezzi non operativi).
                  </p>
                  <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-800">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={chiusuraStandDown}
                      onChange={(e) => setChiusuraStandDown(e.target.checked)}
                    />
                    <span>
                      <strong>Stand-down</strong>
                      {' '}
                      (richiesta annullata dal chiamante / falso allarme; tipo di chiusura registrato
                      sull&apos;evento).
                    </span>
                  </label>
                  <FormField label="Nota di chiusura (obbligatoria)">
                    <textarea
                      className={inputClass}
                      rows={3}
                      value={noteChiusura}
                      onChange={(e) => setNoteChiusura(e.target.value)}
                      placeholder="Motivo della chiusura (es. errore inserimento, evento duplicato)"
                      required
                    />
                  </FormField>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={btnDanger}
                      disabled={closing || !noteChiusura.trim()}
                      onClick={handleChiudiEvento}
                    >
                      {closing ? 'Chiusura in corso' : 'Conferma chiusura evento'}
                    </button>
                    <button
                      type="button"
                      className={btnSecondary}
                      disabled={closing}
                      onClick={() => {
                        setShowCloseForm(false);
                        setNoteChiusura('');
                        setChiusuraStandDown(false);
                      }}
                    >
                      Annulla
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            evento.noteChiusura && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                <p className="font-semibold text-slate-800">Nota di chiusura</p>
                <p className="mt-1 whitespace-pre-wrap text-slate-700">{evento.noteChiusura}</p>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}