import { GripVertical } from 'lucide-react';
import { aprQuickEmojisFromPazienteDoc } from '@pma/lib/aprQuickTerms';
import {
  anagraficaRighePazientePma,
  motivoDettaglioPazientePma,
  mostraEmojiArrivatoPma,
  mostraFrecciaDirettoHPma,
  mostraPettoralePazientePma,
  pettoraleInlineSuRigaNomePma,
} from '../../lib/pmaDeskPatientInfo';
import { PMA_PAZIENTE_DRAG_MIME, setPmaPatientDragDocId } from '../../lib/pmaPostiLetto';
import { PmaAvanzamentoBadge } from './PmaAvanzamentoBadge';
import { PmaOrigineEmoji } from './PmaOrigineEmoji';
import { PmaPettoraleBadge } from './PmaPettoraleBadge';

function DragHandle({ paziente, onDragStart, className = 'pt-0.5' }) {
  return (
    <span
      draggable
      onDragStart={(e) => {
        e.stopPropagation();
        setPmaPatientDragDocId(paziente._docId);
        onDragStart?.(e, paziente._docId);
      }}
      onDragEnd={() => setPmaPatientDragDocId(null)}
      className={`cursor-grab touch-none shrink-0 text-slate-400 active:cursor-grabbing ${className}`}
      title="Trascina sul posto letto"
      aria-hidden
    >
      <GripVertical className="h-4 w-4" />
    </span>
  );
}

/** Blocco compatto anagrafica + motivo per dashboard PMA. */
export function PmaDeskPatientSummary({
  paziente,
  evento = null,
  draggable = false,
  onDragStart,
  showId = true,
  showOrigin = true,
  showColore = false,
  showAvanzamento = true,
  showDirettoHArrow = false,
  missione = null,
  pettoraleHero = false,
  cardTrailing = null,
}) {
  if (!paziente) return null;
  const mostraFrecciaArrivo =
    !mostraEmojiArrivatoPma(paziente, missione) &&
    (showDirettoHArrow || mostraFrecciaDirettoHPma(paziente, missione));
  const mostraArrivatoPma = mostraEmojiArrivatoPma(paziente, missione);
  const { cognome, nome } = anagraficaRighePazientePma(paziente);
  const { tipo, dettaglio } = motivoDettaglioPazientePma(paziente, evento);
  const haNome = Boolean(cognome || nome);
  const aprEmojis = aprQuickEmojisFromPazienteDoc(paziente);
  const mostraPettorale = mostraPettoralePazientePma(paziente);
  const pettoraleInline =
    !pettoraleHero && mostraPettorale && pettoraleInlineSuRigaNomePma(paziente);
  const pettoraleHeroValue =
    pettoraleHero && mostraPettorale ? String(paziente.pettorale).trim() : '';
  const pettoraleInlineValue = pettoraleInline ? String(paziente.pettorale).trim() : '';

  const metaRow = (
    <div className="flex flex-wrap items-center gap-1">
      {showId ? (
        <span className="pma-patient-card__meta font-mono font-bold text-teal-800">
          {paziente.idPaziente}
        </span>
      ) : null}
      {showOrigin ? (
        <span className="inline-flex shrink-0 items-center gap-0.5">
          <PmaOrigineEmoji paziente={paziente} />
          {mostraArrivatoPma ? (
            <span
              className="pma-patient-card__origin shrink-0 leading-none"
              title="Paziente arrivato al PMA"
              aria-label="Paziente arrivato al PMA"
            >
              🏥
            </span>
          ) : mostraFrecciaArrivo ? (
            <span
              className="pma-patient-card__origin shrink-0 leading-none"
              title="Mezzo in DIRETTO H — in arrivo"
              aria-label="Mezzo in DIRETTO H, in arrivo"
            >
              ➡️
            </span>
          ) : null}
        </span>
      ) : null}
      {showAvanzamento ? <PmaAvanzamentoBadge paziente={paziente} /> : null}
    </div>
  );

  const nameRow = haNome ? (
    <p className="leading-tight text-slate-900">
      <span className="flex min-w-0 items-start gap-1">
        <span className="min-w-0 flex-1">
          {pettoraleInlineValue ? (
            <span className="mb-0.5 flex min-w-0 items-center justify-between gap-2">
              <span className="pma-patient-card__name min-w-0 flex-1 truncate font-bold">
                {cognome || nome}
              </span>
              <span
                className="pma-patient-card__pettorale-inline pma-patient-card__name shrink-0 font-bold tabular-nums"
                aria-label={`Pettorale ${pettoraleInlineValue}`}
              >
                {pettoraleInlineValue}
              </span>
            </span>
          ) : mostraPettorale && !pettoraleHeroValue ? (
            <span className="mb-0.5 flex min-w-0 items-center gap-1.5">
              <PmaPettoraleBadge
                pettorale={paziente.pettorale}
                className="pma-patient-card__name shrink-0 px-1.5 py-0.5 font-bold normal-case tracking-normal"
              />
              {cognome ? (
                <span className="pma-patient-card__name truncate font-bold">{cognome}</span>
              ) : null}
            </span>
          ) : cognome ? (
            <span className="pma-patient-card__name block truncate font-bold">{cognome}</span>
          ) : null}
          {nome && !(pettoraleInlineValue && cognome) ? (
            <span className="pma-patient-card__label block truncate font-medium text-slate-700">
              {nome}
            </span>
          ) : null}
        </span>
        {aprEmojis ? (
          <span
            className="pma-patient-card__name shrink-0 leading-none"
            title="APR rapida"
            aria-label="APR rapida"
          >
            {aprEmojis}
          </span>
        ) : null}
      </span>
    </p>
  ) : (
    <p className="pma-patient-card__name truncate font-bold text-slate-500">Anagrafica da completare</p>
  );

  const infoBlock = (
    <>
      <div className="mb-0.5">{metaRow}</div>
      {nameRow}
      {!pettoraleHero && (tipo || dettaglio) ? (
        <p className="pma-patient-card__detail mt-0.5 line-clamp-2 text-slate-600">
          {tipo}
          {tipo && dettaglio ? ' — ' : ''}
          {dettaglio}
        </p>
      ) : null}
    </>
  );

  const motivoAccessoBlock = (
    <div className="pma-patient-card__split-motivo pma-patient-card__split-motivo--bed">
      <p className="pma-patient-card__detail line-clamp-2 leading-snug text-slate-700">
        {tipo || '—'}
      </p>
      <p className="pma-patient-card__detail line-clamp-3 leading-snug text-slate-600">
        {dettaglio || '—'}
      </p>
    </div>
  );

  if (pettoraleHero && cardTrailing) {
    return (
      <div className="flex min-w-0 items-start gap-1">
        {draggable ? <DragHandle paziente={paziente} onDragStart={onDragStart} /> : null}
        <div className="pma-patient-card__split pma-patient-card__split--bed min-w-0 flex-1">
          <div className="pma-patient-card__split-meta min-w-0">{metaRow}</div>
          <div className="pma-patient-card__split-main min-w-0">{nameRow}</div>
          {motivoAccessoBlock}
          {pettoraleHeroValue ? (
            <div
              className="pma-patient-card__pettorale-hero pma-patient-card__pettorale-hero--bed"
              aria-label={`Pettorale ${pettoraleHeroValue}`}
            >
              {pettoraleHeroValue}
            </div>
          ) : (
            <div className="pma-patient-card__pettorale-hero-slot" aria-hidden />
          )}
          <div className="pma-patient-card__split-action shrink-0">{cardTrailing}</div>
        </div>
      </div>
    );
  }

  if (pettoraleHero) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 items-stretch gap-1">
        {draggable ? <DragHandle paziente={paziente} onDragStart={onDragStart} /> : null}
        <div className="pma-patient-card__split pma-patient-card__split--3col min-h-0 min-w-0 flex-1">
          <div className="pma-patient-card__split-main min-w-0">{infoBlock}</div>
          {motivoAccessoBlock}
          {pettoraleHeroValue ? (
            <div
              className="pma-patient-card__pettorale-hero"
              aria-label={`Pettorale ${pettoraleHeroValue}`}
            >
              {pettoraleHeroValue}
            </div>
          ) : (
            <div className="pma-patient-card__pettorale-hero-slot" aria-hidden />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-start gap-1">
      {draggable ? <DragHandle paziente={paziente} onDragStart={onDragStart} /> : null}
      <div className="min-w-0 flex-1">{infoBlock}</div>
      {cardTrailing ? <div className="shrink-0 self-center">{cardTrailing}</div> : null}
    </div>
  );
}

export function startPmaPatientDrag(e, docId) {
  setPmaPatientDragDocId(docId);
  e.dataTransfer.setData(PMA_PAZIENTE_DRAG_MIME, docId);
  e.dataTransfer.setData('text/plain', docId);
  e.dataTransfer.effectAllowed = 'move';
}
