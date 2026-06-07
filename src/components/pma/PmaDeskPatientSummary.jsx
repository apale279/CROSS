import { GripVertical } from 'lucide-react';
import { aprQuickEmojisFromPazienteDoc } from '@pma/lib/aprQuickTerms';
import {
  anagraficaRighePazientePma,
  isPazienteAutopresentatoPma,
  motivoDettaglioPazientePma,
  mostraPettoralePazientePma,
} from '../../lib/pmaDeskPatientInfo';
import { PMA_PAZIENTE_DRAG_MIME, setPmaPatientDragDocId } from '../../lib/pmaPostiLetto';
import { PmaAvanzamentoBadge } from './PmaAvanzamentoBadge';
import { PmaPettoraleBadge } from './PmaPettoraleBadge';

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
}) {
  if (!paziente) return null;
  const { cognome, nome } = anagraficaRighePazientePma(paziente);
  const { tipo, dettaglio } = motivoDettaglioPazientePma(paziente, evento);
  const isAuto = isPazienteAutopresentatoPma(paziente);
  const haNome = Boolean(cognome || nome);
  const aprEmojis = aprQuickEmojisFromPazienteDoc(paziente);

  return (
    <div className="flex min-w-0 items-start gap-1">
      {draggable ? (
        <span
          draggable
          onDragStart={(e) => {
            e.stopPropagation();
            setPmaPatientDragDocId(paziente._docId);
            onDragStart?.(e, paziente._docId);
          }}
          onDragEnd={() => setPmaPatientDragDocId(null)}
          className="cursor-grab touch-none shrink-0 pt-0.5 text-slate-400 active:cursor-grabbing"
          title="Trascina sul posto letto"
          aria-hidden
        >
          <GripVertical className="h-4 w-4" />
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex flex-wrap items-center gap-1">
          {showId ? (
            <span className="font-mono text-[10px] font-bold text-teal-800">{paziente.idPaziente}</span>
          ) : null}
          {showOrigin ? (
            isAuto ? (
              <span className="rounded bg-emerald-100 px-1 py-px text-[9px] font-bold uppercase text-emerald-900">
                Auto
              </span>
            ) : (
              <span className="rounded bg-amber-100 px-1 py-px text-[9px] font-bold uppercase text-amber-900">
                Centrale
              </span>
            )
          ) : null}
          {showAvanzamento ? <PmaAvanzamentoBadge paziente={paziente} /> : null}
        </div>
        {haNome ? (
          <p className="leading-tight text-slate-900">
            <span className="flex min-w-0 items-start gap-1">
              <span className="min-w-0 flex-1">
                {mostraPettoralePazientePma(paziente) ? (
                  <span className="mb-0.5 flex min-w-0 items-center gap-1.5">
                    <PmaPettoraleBadge
                      pettorale={paziente.pettorale}
                      className="shrink-0 px-1.5 py-0.5 text-sm font-bold normal-case tracking-normal"
                    />
                    {cognome ? (
                      <span className="truncate text-sm font-bold">{cognome}</span>
                    ) : null}
                  </span>
                ) : cognome ? (
                  <span className="block truncate text-sm font-bold">{cognome}</span>
                ) : null}
                {nome ? <span className="block truncate text-xs font-medium text-slate-700">{nome}</span> : null}
              </span>
              {aprEmojis ? (
                <span className="shrink-0 text-sm leading-none" title="APR rapida" aria-label="APR rapida">
                  {aprEmojis}
                </span>
              ) : null}
              {showDirettoHArrow ? (
                <span
                  className="shrink-0 text-base font-bold leading-none text-violet-700"
                  title="Mezzo in DIRETTO H — in arrivo"
                  aria-label="Mezzo in DIRETTO H, in arrivo"
                >
                  →
                </span>
              ) : null}
            </span>
          </p>
        ) : (
          <p className="truncate text-sm font-bold text-slate-500">Anagrafica da completare</p>
        )}
        {tipo || dettaglio ? (
          <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-600">
            {tipo}
            {tipo && dettaglio ? ' — ' : ''}
            {dettaglio}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function startPmaPatientDrag(e, docId) {
  setPmaPatientDragDocId(docId);
  e.dataTransfer.setData(PMA_PAZIENTE_DRAG_MIME, docId);
  e.dataTransfer.setData('text/plain', docId);
  e.dataTransfer.effectAllowed = 'move';
}
