import { User } from 'lucide-react';
import { MissioneTelegramSendButton } from '../telegram/MissioneTelegramSendButton';
import { useElapsedSince } from '../../hooks/useElapsedSince';
import { PanelAlertIcon } from '../ui/PanelAlertIcon';
import { ColoreIndicator } from '../ui/ColoreIndicator';
import { eventoColonnaIndirizzo } from '../../lib/eventoDisplay';
import {
  coloreRowBgSoft,
  formatTimeOnly,
  statoMissioneBadgeClass,
} from '../../utils/formatters';
import { operatoreUserLabel } from '../../lib/operatoreAudit';
import {
  resolveCodiceColoreEvento,
  resolveCodiceColoreMissione,
  resolveCodiceColoreTrasporto,
  coloreRigaDashboard,
} from '../../lib/codiciColore';

/**
 * Layout a tre zone (somma = 100%):
 * - Sinistra ~48%: dati evento (6 col)
 * - Centro ~4%: codici colore E · M · T
 * - Destra ~48%: dati e comandi missione
 */
function colPercents(readOnly) {
  const evento = {
    ora: 5,
    evento: 6,
    indirizzo: 20,
    tipo: 8,
    user: 6,
    pz: 3,
  };
  const emt = { e: 1.3, m: 1.3, t: 1.4 };
  const missione = readOnly
    ? { misOra: 5, missione: 8, operatore: 8, mezzo: 12, stato: 15 }
    : { misOra: 5, missione: 7, operatore: 7, mezzo: 11, stato: 14, tg: 4 };
  return { ...evento, ...emt, ...missione };
}

/** Font tabella (px). */
const fsHead = 'text-[15px]';
const fsBody = 'text-[16px]';
const fsSmall = 'text-[14px]';
const fsMicro = 'text-[12px]';

const thBase =
  `sticky top-0 z-10 overflow-hidden bg-slate-100/95 px-0.5 py-1 align-middle ${fsHead} font-bold uppercase leading-none text-slate-600 backdrop-blur`;
const thCompact = `${thBase} w-0 whitespace-nowrap`;
const thEvent = thBase;
const thEventLast = `${thEvent} border-r-2 border-slate-400`;
const thEmt = `${thBase} w-0 bg-slate-200/90 text-center`;
const thMission = `${thBase} bg-slate-50/90`;
const tdBase =
  `overflow-hidden border-t border-slate-200/80 px-0.5 py-0.5 align-middle ${fsBody} leading-none text-slate-900`;
const tdCompact = `${tdBase} w-0 whitespace-nowrap`;
const tdTrunc = `${tdBase} w-0 max-w-0 truncate`;
const tdEventLast = `${tdCompact} border-r-2 border-slate-400`;
const terminatoRowBg = 'bg-slate-200/85';
const tdEmt = `${tdBase} bg-slate-200/40 px-0 text-center`;
const zoneSep = 'border-r-2 border-slate-400';

function ColoreEmtCell({ colore, borderClass = 'border-r border-slate-300', extraClass = '' }) {
  return (
    <td className={`${tdEmt} ${borderClass} ${extraClass}`}>
      <div className="flex items-center justify-center [&_span]:h-4 [&_span]:w-4">
        {colore != null && String(colore).trim() !== '' ? (
          <ColoreIndicator colore={colore} size="sm" />
        ) : (
          <span className={`${fsSmall} text-slate-400`}>—</span>
        )}
      </div>
    </td>
  );
}

function ColoreEmtCells({ coloreE, coloreM, coloreT, className = '' }) {
  return (
    <>
      <ColoreEmtCell colore={coloreE} extraClass={className} />
      <ColoreEmtCell colore={coloreM} extraClass={className} />
      <ColoreEmtCell colore={coloreT} borderClass={zoneSep} extraClass={className} />
    </>
  );
}

function MissioneStatoCell({ mis, onAdvance, readOnly }) {
  const elapsed = useElapsedSince(mis.statoDa ?? mis.apertura);
  return (
    <td className={`${tdBase} w-0 bg-slate-50/30 text-right`}>
      <div className="flex min-w-0 items-center justify-end gap-0.5 overflow-hidden">
        <span className={`min-w-0 truncate font-mono ${fsSmall} tabular-nums text-slate-500`}>{elapsed}</span>
        {readOnly ? (
          <span
            className={`min-w-0 truncate rounded border px-0.5 py-px ${fsSmall} font-bold uppercase ${statoMissioneBadgeClass(mis.stato)}`}
            title={mis.stato}
          >
            {mis.stato}
          </span>
        ) : (
          <button
            type="button"
            onClick={(e) => onAdvance(e, mis)}
            className={`min-w-0 truncate rounded border px-0.5 py-px ${fsSmall} font-bold uppercase hover:opacity-80 ${statoMissioneBadgeClass(mis.stato)}`}
            title={`${mis.stato} — clic per stato successivo`}
          >
            {mis.stato}
          </button>
        )}
      </div>
    </td>
  );
}

function OperatoreUserCell({ doc, className = '', rowSpan, onClick }) {
  const label = operatoreUserLabel(doc);
  return (
    <td
      rowSpan={rowSpan}
      className={`${tdTrunc} ${className}`}
      title={label !== '—' ? label : undefined}
      onClick={onClick}
    >
      {label}
    </td>
  );
}

function EventoCells({
  ev,
  rowSpan,
  orfano,
  prontoOperativoTerminato = false,
  pazientiCount,
  onOpenEvento,
}) {
  const indirizzoColonna = eventoColonnaIndirizzo(ev);
  const canOpenEvento = Boolean(onOpenEvento);
  const open = (e) => {
    e.stopPropagation();
    if (ev && canOpenEvento) onOpenEvento(ev);
  };
  const evClick = canOpenEvento ? 'cursor-pointer hover:brightness-95 ' : '';
  const evTd = `${tdCompact} align-top ${evClick}`;

  return (
    <>
      <td rowSpan={rowSpan} className={`${evTd} text-center font-mono tabular-nums`} onClick={open}>
        {ev ? formatTimeOnly(ev.apertura) : '—'}
      </td>
      <td rowSpan={rowSpan} className={`${evTd} font-mono font-bold`} onClick={open}>
        {ev ? (
          <span className="inline-flex items-center gap-0.5">
            {orfano && (
              <PanelAlertIcon
                variant="amber"
                title="Evento senza copertura"
                className="[&_svg]:h-[20px] [&_svg]:w-[20px]"
              />
            )}
            {(ev.operativoTerminato === true || prontoOperativoTerminato) && (
              <span
                className={`rounded bg-amber-200 px-0.5 ${fsMicro} font-bold uppercase text-amber-950`}
                title="Operatività terminata"
              >
                T
              </span>
            )}
            {ev.idEvento}
          </span>
        ) : (
          '—'
        )}
      </td>
      <td
        rowSpan={rowSpan}
        className={`${tdTrunc} align-top ${evClick}`}
        title={indirizzoColonna || undefined}
        onClick={open}
      >
        {indirizzoColonna || '—'}
      </td>
      <td rowSpan={rowSpan} className={`${tdTrunc} align-top ${evClick}`} title={ev?.tipoEvento} onClick={open}>
        {ev?.tipoEvento ?? '—'}
      </td>
      <OperatoreUserCell doc={ev} rowSpan={rowSpan} className={`align-top ${evClick}`} onClick={open} />
      <td rowSpan={rowSpan} className={`${tdEventLast} align-top text-center`} onClick={open}>
        {ev ? (
          <span
            className="inline-flex items-center gap-0.5 rounded bg-slate-100 px-1 py-px"
            title={`${pazientiCount} pazienti`}
          >
            <User className="h-[18px] w-[18px] shrink-0 text-slate-600" aria-hidden />
            <span className={`font-mono ${fsHead} font-bold tabular-nums`}>{pazientiCount}</span>
          </span>
        ) : (
          '—'
        )}
      </td>
    </>
  );
}

function ColGroup({ readOnly }) {
  const p = colPercents(readOnly);
  const pct = (n) => `${n}%`;
  return (
    <colgroup>
      <col style={{ width: pct(p.ora) }} />
      <col style={{ width: pct(p.evento) }} />
      <col style={{ width: pct(p.indirizzo) }} />
      <col style={{ width: pct(p.tipo) }} />
      <col style={{ width: pct(p.user) }} />
      <col style={{ width: pct(p.pz) }} />
      <col style={{ width: pct(p.e) }} />
      <col style={{ width: pct(p.m) }} />
      <col style={{ width: pct(p.t) }} />
      <col style={{ width: pct(p.misOra) }} />
      <col style={{ width: pct(p.missione) }} />
      <col style={{ width: pct(p.operatore) }} />
      <col style={{ width: pct(p.mezzo) }} />
      <col style={{ width: pct(p.stato) }} />
      {!readOnly && <col style={{ width: pct(p.tg) }} />}
    </colgroup>
  );
}

export function EventiMissioniTable({
  loading,
  blocks,
  pazientiCountByEvento,
  pazientiTrasportoByMissione = new Map(),
  eventi = [],
  telegramEnabled = false,
  readOnly = false,
  onOpenEvento,
  onOpenMissione,
  onAdvanceStato,
}) {
  const missionColSpan = readOnly ? 5 : 6;
  const totalCols = 6 + 3 + missionColSpan;
  const misTd = `${tdCompact} bg-slate-50/30`;

  return (
    <div className="w-full min-w-0 max-w-full overflow-hidden">
      <table className="w-full max-w-full table-fixed border-collapse" style={{ tableLayout: 'fixed' }}>
        <ColGroup readOnly={readOnly} />
        <thead>
          <tr>
            <th className={`${thCompact} text-center`}>Ora</th>
            <th className={thCompact}>Ev.</th>
            <th className={`${thEvent} truncate`}>Indirizzo</th>
            <th className={`${thCompact} truncate`}>Tipo</th>
            <th className={`${thCompact} truncate`}>User</th>
            <th className={`${thEventLast} text-center`}>Pz</th>
            <th className={thEmt} title="Colore evento">
              E
            </th>
            <th className={thEmt} title="Colore missione">
              M
            </th>
            <th className={`${thEmt} ${zoneSep}`} title="Colore trasporto">
              T
            </th>
            <th className={`${thCompact} text-center`}>Ora</th>
            <th className={thCompact}>Mis.</th>
            <th className={`${thCompact} truncate`}>Op.</th>
            <th className={`${thCompact} truncate`}>Mezzo</th>
            <th className={`${thMission} w-0 truncate text-right`}>Stato</th>
            {!readOnly && <th className={`${thCompact} text-center`}>TG</th>}
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={totalCols} className={tdBase} />
            </tr>
          )}
          {!loading &&
            blocks.flatMap((block) => {
              const { ev, missions, orfano, prontoOperativoTerminato } = block;
              const terminato =
                ev?.operativoTerminato === true || prontoOperativoTerminato === true;
              const multiMission = missions.length > 1;
              const blockBorder = multiMission ? 'border-l-2 border-l-violet-500/70' : '';
              const pz = ev ? (pazientiCountByEvento.get(ev._docId) ?? 0) : 0;

              if (!missions.length && ev) {
                const coloreE = resolveCodiceColoreEvento(ev);
                return (
                  <tr
                    key={block.key}
                    className={`${onOpenEvento ? 'cursor-pointer hover:brightness-95' : ''} ${
                      terminato
                        ? terminatoRowBg
                        : orfano
                          ? 'bg-amber-50 ring-1 ring-inset ring-amber-300'
                          : coloreRowBgSoft(coloreE)
                    }`}
                  >
                    <EventoCells
                      ev={ev}
                      rowSpan={1}
                      orfano={orfano}
                      prontoOperativoTerminato={prontoOperativoTerminato}
                      pazientiCount={pz}
                      onOpenEvento={onOpenEvento}
                    />
                    <ColoreEmtCells coloreE={coloreE} coloreM={null} coloreT={null} />
                    <td
                      colSpan={missionColSpan}
                      className={`${tdBase} bg-slate-50/50 text-center italic text-slate-500`}
                    >
                      Nessuna missione aperta
                    </td>
                  </tr>
                );
              }

              return missions.map((mis, idx) => {
                const pazTrasporto = pazientiTrasportoByMissione.get(mis._docId) ?? [];
                const coloreM = resolveCodiceColoreMissione(mis);
                const coloreT = resolveCodiceColoreTrasporto(mis);
                const coloreRiga = coloreRigaDashboard(mis, ev);
                const daAllertare = mis.stato === 'ALLERTARE';
                const emtClass = multiMission ? 'border-r-violet-200/70' : '';

                return (
                  <tr
                    key={mis._docId}
                    onClick={onOpenMissione ? () => onOpenMissione(mis) : undefined}
                    className={`${onOpenMissione ? 'cursor-pointer hover:brightness-95' : ''} ${
                      terminato
                        ? terminatoRowBg
                        : `${coloreRowBgSoft(coloreRiga)} ${orfano && idx === 0 ? 'bg-amber-50/40' : ''}`
                    } ${daAllertare && !terminato ? 'ring-1 ring-inset ring-red-400' : ''} ${blockBorder}`}
                  >
                    {ev ? (
                      idx === 0 && (
                        <EventoCells
                          ev={ev}
                          rowSpan={missions.length}
                          orfano={orfano}
                          prontoOperativoTerminato={prontoOperativoTerminato}
                          pazientiCount={pz}
                          onOpenEvento={onOpenEvento}
                        />
                      )
                    ) : (
                      <EventoCells
                        ev={null}
                        rowSpan={1}
                        orfano={false}
                        pazientiCount={0}
                        onOpenEvento={onOpenEvento}
                      />
                    )}
                    <ColoreEmtCells
                      coloreE={resolveCodiceColoreEvento(ev)}
                      coloreM={coloreM}
                      coloreT={coloreT}
                      className={`align-top ${emtClass}`}
                    />
                    <td className={`${misTd} text-center font-mono tabular-nums`}>
                      {formatTimeOnly(mis.apertura)}
                    </td>
                    <td className={`${misTd} font-mono font-bold tabular-nums`}>
                      <span className="inline-flex items-center gap-0.5">
                        {daAllertare && (
                          <PanelAlertIcon
                            variant="red"
                            title="Missione da allertare"
                            className="[&_svg]:h-[20px] [&_svg]:w-[20px]"
                          />
                        )}
                        {mis.idMissione}
                      </span>
                    </td>
                    <OperatoreUserCell doc={mis} className="bg-slate-50/30" />
                    <td className={`${tdTrunc} bg-slate-50/30 font-mono`} title={mis.mezzo || undefined}>
                      {mis.mezzo || '—'}
                    </td>
                    <MissioneStatoCell mis={mis} onAdvance={onAdvanceStato} readOnly={readOnly} />
                    {!readOnly && (
                      <td className={`${tdBase} bg-slate-50/30 text-center`}>
                        <MissioneTelegramSendButton
                          missione={mis}
                          evento={ev}
                          eventi={eventi}
                          telegramEnabled={telegramEnabled}
                          className="[&_button>span]:hidden [&_button]:px-1 [&_svg]:h-[14px] [&_svg]:w-[14px]"
                        />
                      </td>
                    )}
                  </tr>
                );
              });
            })}
        </tbody>
      </table>
    </div>
  );
}
