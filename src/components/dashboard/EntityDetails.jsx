import { Link } from 'react-router-dom';
import { useManifestazioneId } from '../../context/ManifestazioneContext';
import { coloreBadgeClass, formatTimestamp } from '../../utils/formatters';
import { parseCoordinate } from '../../lib/googleMaps';
import { btnDanger, btnSecondary } from '../ui/FormField';
import { deleteMezzo } from '../../services/mezziService';
import { confirmDelete } from '../../utils/confirmDelete';

export function EventoDetail({ evento }) {
  if (!evento) return null;
  const manifestazioneId = useManifestazioneId();
  const coord = parseCoordinate(evento.coordinate);

  return (
    <dl className="space-y-3 text-sm">
      <Row label="ID" value={evento.idEvento} mono />
      <Row label="Apertura" value={formatTimestamp(evento.apertura)} />
      <Row label="Aperto" value={evento.stato !== false ? 'Sì' : 'No'} />
      <Row label="Indirizzo" value={evento.indirizzo || '—'} />
      <Row
        label="Coordinate"
        value={coord ? `${coord.lat.toFixed(5)}, ${coord.lng.toFixed(5)}` : '—'}
      />
      <Row label="Tipo" value={evento.tipoEvento} />
      <Row label="Dettaglio" value={evento.dettaglioEvento || '—'} />
      <Row label="Colore">
        <span
          className={`inline-block rounded-full border px-2 py-0.5 text-xs ${coloreBadgeClass(evento.colore)}`}
        >
          {evento.colore}
        </span>
      </Row>
      <Row label="Note" value={evento.noteEvento || '—'} />
      {evento.eventoGenitoreCorrelato && (
        <Row
          label="Evento padre"
          value={`${evento.eventoGenitoreCorrelato}${evento.origineEccezione ? ` (${evento.origineEccezione})` : ''}`}
          mono
        />
      )}
      {evento.tipoChiusuraEvento && (
        <Row
          label="Tipo chiusura"
          value={
            evento.tipoChiusuraEvento === 'STAND_DOWN'
              ? 'Stand-down (richiesta annullata)'
              : evento.tipoChiusuraEvento
          }
        />
      )}
      {evento.noteChiusura && (
        <Row label="Nota chiusura" value={evento.noteChiusura} />
      )}
      <Link to="/eventi" className={`${btnSecondary} inline-block text-center`}>
        Eventi
      </Link>
    </dl>
  );
}

export function MezzoDetail({ mezzo, onDeleted }) {
  if (!mezzo) return null;
  const manifestazioneId = useManifestazioneId();
  const sigla = mezzo.sigla ?? mezzo._docId;
  const coord = parseCoordinate(mezzo.stazionamento?.coordinate);

  return (
    <dl className="space-y-3 text-sm">
      <Row label="Sigla" value={sigla} mono />
      <Row label="Tipo" value={mezzo.tipo} />
      <Row label="Targa" value={mezzo.targa || '—'} />
      <Row label="Radio" value={mezzo.radio || '—'} />
      <Row label="Stato" value={mezzo.statoMezzo ?? 'Disponibile'} />
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
          Mezzi
        </Link>
        <button
          type="button"
          className={btnDanger}
          onClick={async () => {
            if (!confirmDelete(`mezzo ${sigla}`)) return;
            await deleteMezzo(manifestazioneId, sigla);
            onDeleted?.();
          }}
        >
          Elimina mezzo
        </button>
      </div>
    </dl>
  );
}

export function MissioneDetail({ missione, evento, mezzo }) {
  if (!missione) return null;

  return (
    <dl className="space-y-3 text-sm">
      <Row label="ID" value={missione.idMissione} mono />
      <Row label="Evento" value={missione.eventoCorrelato} />
      <Row label="Mezzo" value={missione.mezzo} mono />
      <Row label="Stato" value={missione.stato} />
      <Row label="Aperta" value={missione.aperta !== false ? 'Sì' : 'No'} />
      <Row label="Apertura" value={formatTimestamp(missione.apertura)} />
      <Row label="Equipaggio" value={missione.equipaggio || '—'} />
      {missione.missioneEccezioneMotivo && (
        <>
          <Row label="Eccezione" value={missione.missioneEccezioneMotivo} />
          <Row label="Nota eccezione" value={missione.missioneEccezioneNote || '—'} />
        </>
      )}
      {evento && (
        <>
          <hr className="border-slate-200" />
          <p className="text-xs font-bold uppercase text-slate-500">Evento</p>
          <Row label="Indirizzo" value={evento.indirizzo || '—'} />
          <Row label="Tipo" value={`${evento.tipoEvento} — ${evento.dettaglioEvento || ''}`} />
        </>
      )}
      {mezzo && (
        <>
          <hr className="border-slate-200" />
          <p className="text-xs font-bold uppercase text-slate-500">Mezzo</p>
          <Row label="Stato mezzo" value={mezzo.statoMezzo} />
        </>
      )}
      <Link to="/missioni" className={`${btnSecondary} inline-block text-center`}>
        Missioni
      </Link>
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
