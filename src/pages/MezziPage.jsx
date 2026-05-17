import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { DEFAULT_IMPOSTAZIONI } from '../constants';
import { useImpostazioni } from '../hooks/useImpostazioni';
import { useManifestazioneId } from '../context/ManifestazioneContext';
import { COLLECTIONS } from '../lib/firestorePaths';
import { useManifestazioneCollection } from '../hooks/useManifestazioneCollection';
import { AddressPicker } from '../components/maps/AddressPicker';
import { LuogoFisicoField } from '../components/maps/LuogoFisicoField';
import { StazionamentoImport } from '../components/mezzi/StazionamentoImport';
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
import { normalizeTipiMezzo } from '../lib/tipiMezzo';
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
  stazionamento: { indirizzo: '', luogo_fisico: '', coordinate: null },
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
      await createMezzo(manifestazioneId, sigla, form);
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

  return (
    <div className="mx-auto max-w-6xl pb-8">
      <header className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold uppercase text-slate-900">Mezzi</h2>
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
      </header>

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
            <div className="md:col-span-2 space-y-3">
              <p className="text-sm font-medium text-slate-700">Stazionamento</p>
              <StazionamentoImport
                stazionamenti={stazionamentiPreset}
                onImport={(stazionamento) => setForm((f) => ({ ...f, stazionamento }))}
              />
              <LuogoFisicoField
                value={form.stazionamento.luogo_fisico}
                onChange={(luogo_fisico) =>
                  setForm((f) => ({
                    ...f,
                    stazionamento: { ...f.stazionamento, luogo_fisico },
                  }))
                }
              />
              <AddressPicker
                indirizzo={form.stazionamento.indirizzo}
                coordinate={form.stazionamento.coordinate}
                onCommit={({ indirizzo, coordinate }) =>
                  setForm((f) => ({
                    ...f,
                    stazionamento: { ...f.stazionamento, indirizzo, coordinate },
                  }))
                }
              />
            </div>
            <label className="flex items-center gap-2 md:col-span-2">
              <input
                type="checkbox"
                checked={form.stazionamentoPredefinito}
                onChange={(e) =>
                  setForm((f) => ({ ...f, stazionamentoPredefinito: e.target.checked }))
                }
              />
              <span className="text-sm text-slate-700">Stazionamento predefinito</span>
            </label>
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
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-slate-700">Stazionamento</p>
                      <StazionamentoImport
                        stazionamenti={stazionamentiPreset}
                        onImport={(stazionamento) => patch(sigla, { stazionamento })}
                      />
                      <AddressPicker
                        indirizzo={m.stazionamento?.indirizzo ?? ''}
                        coordinate={m.stazionamento?.coordinate}
                        onCommit={({ indirizzo, coordinate }) =>
                          patch(sigla, { stazionamento: { indirizzo, coordinate } })
                        }
                      />
                    </div>
                    <EquipaggioForm
                      equipaggio={m.equipaggio ?? emptyEquipaggio()}
                      onChange={(equipaggio) => patch(sigla, { equipaggio })}
                    />
                    <button
                      type="button"
                      className={btnDanger}
                      onClick={async () => {
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
