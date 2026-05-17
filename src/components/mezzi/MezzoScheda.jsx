import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useManifestazioneId } from '../../context/ManifestazioneContext';
import { MEZZO_STATO_DISPONIBILE } from '../../lib/mezzoStati';
import { parseCoordinate } from '../../lib/googleMaps';
import { deleteMezzo, patchMezzo } from '../../services/mezziService';
import { confirmDelete } from '../../utils/confirmDelete';
import { btnDanger, btnSecondary } from '../ui/FormField';
import { MezzoStatoSelect } from './MezzoStatoSelect';

/** Scheda mezzo (modale dashboard): dettaglio + modifica stato disponibilità. */
export function MezzoScheda({ mezzo, onDeleted }) {
  const manifestationId = useManifestazioneId();
  const [savingStato, setSavingStato] = useState(false);

  if (!mezzo) return null;

  const sigla = mezzo.sigla ?? mezzo._docId;
  const coord = parseCoordinate(mezzo.stazionamento?.coordinate);
  const stato = mezzo.statoMezzo ?? MEZZO_STATO_DISPONIBILE;

  const handleStatoChange = async (e) => {
    const statoMezzo = e.target.value;
    if (statoMezzo === (mezzo.statoMezzo ?? MEZZO_STATO_DISPONIBILE)) return;
    setSavingStato(true);
    try {
      await patchMezzo(manifestationId, sigla, { statoMezzo });
    } catch (err) {
      console.error(err);
      alert('Errore aggiornamento stato mezzo: ' + err.message);
    } finally {
      setSavingStato(false);
    }
  };

  return (
    <dl className="space-y-3 text-sm">
      <Row label="Sigla" value={sigla} mono />
      <Row label="Tipo" value={mezzo.tipo} />
      <Row label="Targa" value={mezzo.targa || '—'} />
      <Row label="Radio" value={mezzo.radio || '—'} />
      <Row label="Stato mezzo">
        <MezzoStatoSelect value={stato} onChange={handleStatoChange} saving={savingStato} />
        {savingStato && <span className="mt-1 block text-xs text-slate-500">Salvataggio…</span>}
      </Row>
      <Row label="Operativo" value={mezzo.operativo !== false ? 'Sì' : 'No'} />
      {mezzo.operativo === false && <Row label="Note" value={mezzo.noteOperativo || '—'} />}
      <Row label="Stazionamento" value={mezzo.stazionamento?.indirizzo || '—'} />
      <Row
        label="Coordinate"
        value={coord ? `${coord.lat.toFixed(5)}, ${coord.lng.toFixed(5)}` : '—'}
      />
      <EquipaggioList equipaggio={mezzo.equipaggio} />
      <div className="flex flex-wrap gap-2 pt-2">
        <Link to="/mezzi" className={`${btnSecondary} inline-block text-center`}>
          Pagina mezzi
        </Link>
        <button
          type="button"
          className={btnDanger}
          onClick={async () => {
            if (!confirmDelete(`mezzo ${sigla}`)) return;
            await deleteMezzo(manifestationId, sigla);
            onDeleted?.();
          }}
        >
          Elimina mezzo
        </button>
      </div>
    </dl>
  );
}

function Row({ label, value, mono, children }) {
  return (
    <div className="grid grid-cols-3 gap-2 border-b border-slate-100 pb-2">
      <dt className="font-medium text-slate-500">{label}</dt>
      <dd className={`col-span-2 text-slate-900 ${mono ? 'font-mono' : ''}`}>
        {children ?? value}
      </dd>
    </div>
  );
}

function EquipaggioList({ equipaggio }) {
  if (!equipaggio) return null;
  const roles = [
    ['Autista', equipaggio.autista],
    ['Medico/CE', equipaggio.medico],
    ['Soccorritore 1', equipaggio.soccorritore1],
    ['Soccorritore 2', equipaggio.soccorritore2],
  ];
  return (
    <div>
      <p className="mb-1 font-medium text-slate-500">Equipaggio</p>
      <ul className="space-y-1 text-slate-800">
        {roles.map(([label, p]) => (
          <li key={label}>
            <span className="text-slate-500">{label}:</span>{' '}
            {[p?.nome, p?.cognome].filter(Boolean).join(' ') || '—'}
            {p?.telefono ? ` (${p.telefono})` : ''}
          </li>
        ))}
      </ul>
    </div>
  );
}
