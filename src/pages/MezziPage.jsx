import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { DEFAULT_IMPOSTAZIONI } from '../constants';
import { useImpostazioni } from '../hooks/useImpostazioni';
import { useManifestazioneId } from '../context/ManifestazioneContext';
import { COLLECTIONS } from '../lib/firestorePaths';
import { getMezzoDeleteBlockReason } from '../lib/mezzoDeleteGuard';
import { applyStazionamentoOnMezzoCreate } from '../lib/mezzoStazionamentoAssign';
import { useManifestazioneCollection } from '../hooks/useManifestazioneCollection';
import { MezzoStazionamentoSelect } from '../components/mezzi/MezzoStazionamentoSelect';
import { EquipaggioForm } from '../components/mezzi/EquipaggioForm';
import {
  createMezzo,
  deleteMezzo,
  emptyEquipaggio,
  patchMezzo,
} from '../services/mezziService';
import { confirmDelete } from '../utils/confirmDelete';
import { MezzoStatoSelect } from '../components/mezzi/MezzoStatoSelect';
import { MEZZO_STATO_DISPONIBILE } from '../lib/mezzoStati';
import {
  findStazionamentoById,
  mezzoPatchFromStazionamentoPreset,
  resolveMezzoStazionamentoId,
} from '../lib/mezzoStazionamentoAssign';
import { normalizeTipiMezzo } from '../lib/tipiMezzo';
import { parseFlottaMezziExcel } from '../lib/parseFlottaMezziExcel';
import { importMezziFromFlottaExcel } from '../services/mezziImportService';
import {
  FormField,
  btnDanger,
  btnPrimary,
  btnSecondary,
  inputClass,
  selectClass,
} from '../components/ui/FormField';

const emptyForm = (tipiMezzo) => ({
  sigla: '',
  tipo: tipiMezzo[0]?.nome ?? '',
  stazionamentoId: '',
  stazionamento: { indirizzo: '', luogo_fisico: '', note: '', coordinate: null },
  stazionamentoPredefinito: false,
  targa: '',
  radio: '',
  equipaggio: emptyEquipaggio(),
  operativo: true,
  noteOperativo: '',
});

export default function MezziPage() {
  const manifestazioneId = useManifestazioneId();
  const { impostazioni } = useImpostazioni();
  const tipiMezzo = useMemo(
    () => normalizeTipiMezzo(impostazioni.tipiMezzo ?? DEFAULT_IMPOSTAZIONI.tipiMezzo),
    [impostazioni.tipiMezzo],
  );
  const stazionamentiPreset = impostazioni.stazionamenti ?? [];
  const { data: mezzi, loading } = useManifestazioneCollection(COLLECTIONS.mezzi);
  const { data: missioni } = useManifestazioneCollection(COLLECTIONS.missioni);
  const [form, setForm] = useState(() => emptyForm(tipiMezzo));
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    setForm((f) => {
      if (!tipiMezzo.length) return f;
      const names = tipiMezzo.map((t) => t.nome);
      if (f.tipo && names.includes(f.tipo)) return f;
      return { ...f, tipo: tipiMezzo[0]?.nome ?? '' };
    });
  }, [tipiMezzo]);

  const [saving, setSaving] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [importFeedback, setImportFeedback] = useState('');
  const fileRef = useRef(null);
  const [expanded, setExpanded] = useState(null);

  const handleCreate = async (e) => {
    e.preventDefault();
    const sigla = form.sigla.trim().replace(/\s+/g, '');
    if (!sigla) {
      alert('La sigla è obbligatoria e non può contenere spazi.');
      return;
    }
    if (mezzi.some((m) => m.sigla === sigla || m._docId === sigla)) {
      alert('Sigla già esistente.');
      return;
    }
    setSaving(true);
    try {
      const payload = applyStazionamentoOnMezzoCreate(form, stazionamentiPreset);
      await createMezzo(manifestazioneId, sigla, payload);
      setForm(emptyForm(tipiMezzo));
      setShowForm(false);
    } catch (err) {
      console.error(err);
      alert('Errore creazione mezzo: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const patch = (sigla, fields) => patchMezzo(manifestazioneId, sigla, fields);

  const assignStazionamento = (sigla, presetId) => {
    const preset = findStazionamentoById(presetId, stazionamentiPreset);
    patch(sigla, mezzoPatchFromStazionamentoPreset(preset));
  };

  const onImportExcel = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.xlsx') && !lower.endsWith('.xls')) {
      alert('Seleziona un file Excel (.xlsx o .xls).');
      e.target.value = '';
      return;
    }
    if (!stazionamentiPreset.length) {
      alert(
        'Importa prima gli stazionamenti da Impostazioni (foglio STAZIONAMENTI dello stesso file Excel).',
      );
      e.target.value = '';
      return;
    }
    setImportBusy(true);
    setImportFeedback('');
    try {
      const buf = await file.arrayBuffer();
      const { sheetName, entries } = parseFlottaMezziExcel(buf);
      if (!entries.length) {
        alert('Nessuna riga valida nel foglio FLOTTA (A=sigla, B=tipo, C=stazionamento).');
        return;
      }
      if (
        !window.confirm(
          `Importare fino a ${entries.length} mezzi dal foglio «${sheetName}»? Le sigle già presenti verranno saltate. I tipi mezzo mancanti verranno creati in Impostazioni.`,
        )
      ) {
        return;
      }
      const result = await importMezziFromFlottaExcel(manifestazioneId, buf, {
        stazionamenti: stazionamentiPreset,
        tipiMezzo,
        existingMezzi: mezzi,
      });
      let msg = `Creati ${result.created} mezzi da «${result.sheetName}».`;
      if (result.tipiAggiunti.length) {
        msg += ` Tipi aggiunti: ${result.tipiAggiunti.join(', ')}.`;
      }
      if (result.skipped.length) {
        msg += ` Saltate ${result.skipped.length} sigle già presenti.`;
      }
      if (result.missingStazionamenti.length) {
        msg += ` Attenzione: stazionamenti non trovati (${result.missingStazionamenti.join(', ')}).`;
      }
      setImportFeedback(msg);
      if (result.missingStazionamenti.length) {
        console.warn('Stazionamenti mancanti', result.missingStazionamenti);
      }
    } catch (err) {
      console.error(err);
      alert('Errore import: ' + (err?.message ?? err));
    } finally {
      setImportBusy(false);
      e.target.value = '';
    }
  };

  return (
    <div className="mx-auto max-w-6xl pb-8">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold uppercase text-slate-900">Mezzi</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={btnSecondary}
            disabled={importBusy || saving}
            onClick={() => fileRef.current?.click()}
          >
            {importBusy ? 'Import…' : 'Importa Excel FLOTTA'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={onImportExcel}
          />
          <button
            type="button"
            className={`${btnPrimary} flex items-center gap-2`}
            onClick={() => {
              setShowForm((v) => {
                if (!v) setForm(emptyForm(tipiMezzo));
                return !v;
              });
            }}
          >
            <Plus className="h-4 w-4" />
            Nuovo mezzo
          </button>
        </div>
      </header>
      <p className="mb-2 text-xs text-slate-600">
        Import da foglio <strong>FLOTTA</strong> (es. FLOTTA RESEGUP): <strong>A</strong> sigla,{' '}
        <strong>B</strong> tipo mezzo (creato in impostazioni se assente), <strong>C</strong> nome
        stazionamento (col. C) = sede del mezzo dall’elenco STAZIONAMENTI in Impostazioni.
      </p>
      {importFeedback && (
        <p className="mb-4 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {importFeedback}
        </p>
      )}

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mb-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h3 className="mb-4 text-lg font-semibold">Nuovo mezzo</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Sigla (ID univoco)">
              <input
                className={inputClass}
                value={form.sigla}
                onChange={(e) =>
                  setForm((f) => ({ ...f, sigla: e.target.value.replace(/\s/g, '') }))
                }
                placeholder="es. AMB01"
              />
            </FormField>
            <FormField label="Tipo mezzo">
              <select
                className={selectClass}
                value={form.tipo}
                onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
              >
                {tipiMezzo.map((t) => (
                  <option key={t.nome} value={t.nome}>
                    {t.emoji} {t.nome}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Targa">
              <input
                className={inputClass}
                value={form.targa}
                onChange={(e) => setForm((f) => ({ ...f, targa: e.target.value }))}
              />
            </FormField>
            <FormField label="Radio">
              <input
                className={inputClass}
                value={form.radio}
                onChange={(e) => setForm((f) => ({ ...f, radio: e.target.value }))}
              />
            </FormField>
            <div className="md:col-span-2">
              <MezzoStazionamentoSelect
                stazionamenti={stazionamentiPreset}
                valueId={form.stazionamentoId}
                onSelectId={(id) => {
                  const preset = findStazionamentoById(id, stazionamentiPreset);
                  setForm((f) => ({ ...f, ...mezzoPatchFromStazionamentoPreset(preset) }));
                }}
              />
            </div>
            <div className="md:col-span-2">
              <EquipaggioForm
                equipaggio={form.equipaggio}
                onChange={(equipaggio) => setForm((f) => ({ ...f, equipaggio }))}
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="submit" className={btnPrimary} disabled={saving}>
              {saving ? 'Salvataggio…' : 'Crea mezzo'}
            </button>
            <button type="button" className={btnSecondary} onClick={() => setShowForm(false)}>
              Annulla
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {!loading &&
          mezzi.map((m) => {
            const sigla = m.sigla ?? m._docId;
            const isOpen = expanded === sigla;
            return (
              <article
                key={sigla}
                className="rounded-xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3">
                  <span className="font-mono text-lg font-bold text-sky-700">{sigla}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{m.tipo}</span>
                  <MezzoStatoSelect
                    className="!w-auto min-w-[10rem] py-1 text-xs"
                    value={m.statoMezzo ?? MEZZO_STATO_DISPONIBILE}
                    onChange={(e) => patch(sigla, { statoMezzo: e.target.value })}
                  />
                  <span className="text-sm text-slate-500">
                    {m.targa && `Targa ${m.targa}`}
                    {m.radio && ` · Radio ${m.radio}`}
                  </span>
                  <label className="ml-auto flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={m.operativo !== false}
                      onChange={(e) =>
                        patch(sigla, { operativo: e.target.checked })
                      }
                    />
                    Operativo
                  </label>
                  <button
                    type="button"
                    className={btnSecondary}
                    onClick={() => setExpanded(isOpen ? null : sigla)}
                  >
                    {isOpen ? 'Chiudi' : 'Modifica'}
                  </button>
                </div>
                {m.operativo === false && (
                  <div className="border-b border-slate-100 px-4 py-2">
                    <input
                      className={inputClass}
                      placeholder="Note (mezzo non operativo)"
                      defaultValue={m.noteOperativo ?? ''}
                      onBlur={(e) => {
                        if (e.target.value !== (m.noteOperativo ?? '')) {
                          patch(sigla, { noteOperativo: e.target.value });
                        }
                      }}
                    />
                  </div>
                )}
                {isOpen && (
                  <div className="space-y-4 p-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <FormField label="Tipo">
                        <select
                          className={selectClass}
                          value={m.tipo ?? ''}
                          onChange={(e) => patch(sigla, { tipo: e.target.value })}
                        >
                          {tipiMezzo.map((t) => (
                            <option key={t.nome} value={t.nome}>
                              {t.emoji} {t.nome}
                            </option>
                          ))}
                        </select>
                      </FormField>
                    </div>
                    <MezzoStazionamentoSelect
                      stazionamenti={stazionamentiPreset}
                      valueId={resolveMezzoStazionamentoId(m, stazionamentiPreset)}
                      onSelectId={(id) => assignStazionamento(sigla, id)}
                    />
                    <EquipaggioForm
                      equipaggio={m.equipaggio ?? emptyEquipaggio()}
                      onChange={(equipaggio) => patch(sigla, { equipaggio })}
                    />
                    <button
                      type="button"
                      className={btnDanger}
                      onClick={async () => {
                        const block = getMezzoDeleteBlockReason(sigla, missioni);
                        if (block) {
                          alert(block);
                          return;
                        }
                        if (!confirmDelete(`mezzo ${sigla}`)) return;
                        await deleteMezzo(manifestazioneId, sigla);
                        setExpanded(null);
                      }}
                    >
                      Elimina mezzo
                    </button>
                  </div>
                )}
              </article>
            );
          })}
      </div>
    </div>
  );
}
