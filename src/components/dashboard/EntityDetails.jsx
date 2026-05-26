import { Link } from 'react-router-dom';
import {
  resolveCodiceColoreEvento,
  resolveCodiceColoreMissione,
  resolveCodiceColoreTrasporto,
} from '../../lib/codiciColore';
import { eventoColonnaIndirizzo } from '../../lib/eventoDisplay';
import { isEventoOperativoTerminato } from '../../lib/eventoLinks';
import { coloreBadgeClass, formatTimestamp } from '../../utils/formatters';
import { parseCoordinate } from '../../lib/googleMaps';
import { btnSecondary } from '../ui/FormField';

export function EventoDetail({ evento }) {
  if (!evento) return null;
  const coord = parseCoordinate(evento.coordinate);
  const indirizzoLabel = eventoColonnaIndirizzo(evento) || '—';

  return (
    <dl className="space-y-3 text-sm">
      <Row label="ID" value={evento.idEvento} mono />
      <Row label="Apertura" value={formatTimestamp(evento.apertura)} />
      <Row label="Aperto" value={evento.stato !== false ? 'Sì' : 'No'} />
      {isEventoOperativoTerminato(evento) ? (
        <Row
          label="Operatività"
          value={`Terminata${evento.operativoTerminatoIl ? ` (${formatTimestamp(evento.operativoTerminatoIl)})` : ''}`}
        />
      ) : null}
      <Row label="Chiamante" value={evento.chiamante || '—'} />
      <Row label="Luogo (indirizzo)" value={indirizzoLabel} />
      <Row label="Luogo fisico" value={evento.luogo_fisico || '—'} />
      <Row label="Indirizzo geo" value={evento.indirizzo || '—'} />
      <Row
        label="Coordinate"
        value={coord ? `${coord.lat.toFixed(5)}, ${coord.lng.toFixed(5)}` : '—'}
      />
      <Row label="Luogo" value={evento.luogo || '—'} />
      <Row label="Tipo luogo" value={evento.tipoLuogo || '—'} />
      <Row label="Meteo" value={evento.meteo || '—'} />
      <Row label="Tipo evento" value={evento.tipoEvento || '—'} />
      <Row label="Dettaglio evento" value={evento.dettaglioEvento || '—'} />
      <Row label="Colore evento (E)">
        <span
          className={`inline-block rounded-full border px-2 py-0.5 text-xs ${coloreBadgeClass(resolveCodiceColoreEvento(evento))}`}
        >
          {resolveCodiceColoreEvento(evento)}
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

export { MezzoScheda as MezzoDetail } from '../mezzi/MezzoScheda';

export function MissioneDetail({ missione, evento, mezzo, pazientiTrasporto = [] }) {
  if (!missione) return null;

  const coloreM = resolveCodiceColoreMissione(missione);
  const coloreT = resolveCodiceColoreTrasporto(missione, evento, pazientiTrasporto);

  return (
    <dl className="space-y-3 text-sm">
      <Row label="ID" value={missione.idMissione} mono />
      <Row label="Evento" value={missione.eventoCorrelato} />
      <Row label="Mezzo" value={missione.mezzo} mono />
      <Row label="Colore M" value={coloreM ?? '—'} />
      <Row label="Colore T" value={coloreT ?? '—'} />
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
          <Row label="Luogo" value={eventoColonnaIndirizzo(evento) || '—'} />
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
