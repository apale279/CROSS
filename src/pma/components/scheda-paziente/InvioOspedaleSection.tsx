import { Timestamp } from 'firebase/firestore'
import { datetimeLocalToTimestamp, toDatetimeLocal } from '@pma/lib/schedaDatetimeLocal'
import type { Paziente } from '@pma/types/paziente'

const CODICI_TRASPORTO = ['verde', 'giallo', 'rosso'] as const

type Props = {
  p: Paziente
  /** Matrice Rank.xlsx: ruoli senza UPDATE su Invio PS o scheda chiusa senza permesso. */
  readOnly?: boolean
  /** Eccezione lock: non dipende da `aperto`. */
  writeInvio: (patch: Record<string, unknown>) => Promise<void>
}

/**
 * Sezione 5 — Dati invio ospedale (solo esito dimissione = Invio in PS).
 * Resta editabile anche con scheda chiusa (`aperto === false`) per i ruoli abilitati in matrice.
 */
export function InvioOspedaleSection({ p, readOnly = false, writeInvio }: Props) {
  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="max-w-3xl">
        <div className="pma-row pma-row--2">
          <label className="pma-field pma-field--br">
            <span className="pma-field__label">N° missione AREU</span>
            <input
              key={`areu-${p.id}-${p.invio_ps_missione_areu ?? 'x'}`}
              type="number"
              min={0}
              step={1}
              defaultValue={p.invio_ps_missione_areu ?? ''}
              disabled={readOnly}
              onBlur={(e) => {
                if (readOnly) return
                const v = e.target.value.trim()
                if (v === '') {
                  void writeInvio({ invio_ps_missione_areu: null })
                  return
                }
                const n = Number(v)
                if (Number.isFinite(n)) void writeInvio({ invio_ps_missione_areu: Math.floor(n) })
              }}
            />
          </label>

          <label className="pma-field">
            <span className="pma-field__label">Data e ora</span>
            <input
              key={`dto-${p.id}-${p.invio_ps_data_ora?.toMillis?.() ?? 'empty'}`}
              type="datetime-local"
              defaultValue={p.invio_ps_data_ora ? toDatetimeLocal(p.invio_ps_data_ora) : ''}
              disabled={readOnly}
              onBlur={(e) => {
                if (readOnly) return
                const ts = datetimeLocalToTimestamp(e.target.value)
                if (ts) void writeInvio({ invio_ps_data_ora: ts })
              }}
            />
            <button
              type="button"
              disabled={readOnly}
              className="mt-2 text-xs text-slate-600 underline disabled:cursor-not-allowed disabled:opacity-40"
              onClick={() => {
                if (readOnly) return
                void writeInvio({ invio_ps_data_ora: Timestamp.now() })
              }}
            >
              Imposta a ora corrente
            </button>
          </label>
        </div>

        <div className="pma-row">
          <label className="pma-field">
            <span className="pma-field__label">Mezzo</span>
            <input
              key={`mezzo-${p.id}-${p.invio_ps_mezzo}`}
              type="text"
              defaultValue={p.invio_ps_mezzo}
              disabled={readOnly}
              onBlur={(e) => {
                if (readOnly) return
                void writeInvio({ invio_ps_mezzo: e.target.value })
              }}
            />
          </label>
        </div>

        <div className="pma-row">
          <label className="pma-field">
            <span className="pma-field__label">Ospedale di destinazione</span>
            <input
              key={`osp-${p.id}-${p.invio_ps_ospedale}`}
              type="text"
              defaultValue={p.invio_ps_ospedale}
              disabled={readOnly}
              onBlur={(e) => {
                if (readOnly) return
                void writeInvio({ invio_ps_ospedale: e.target.value })
              }}
            />
          </label>
        </div>

        <div className="pma-row">
          <label className="pma-field max-w-md">
            <span className="pma-field__label">Codice trasporto</span>
            <select
              disabled={readOnly}
              value={p.invio_ps_codice_trasporto ?? ''}
              onChange={(e) => {
                if (readOnly) return
                const v = e.target.value
                void writeInvio({
                  invio_ps_codice_trasporto:
                    v === '' ? null : (v as (typeof CODICI_TRASPORTO)[number]),
                })
              }}
            >
              <option value="">— Seleziona —</option>
              {CODICI_TRASPORTO.map((c) => (
                <option key={c} value={c}>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="pma-row">
          <label className="pma-field">
            <span className="pma-field__label">Note trasporto</span>
            <textarea
              key={`note-${p.id}-${p.invio_ps_note}`}
              rows={4}
              defaultValue={p.invio_ps_note}
              disabled={readOnly}
              onBlur={(e) => {
                if (readOnly) return
                void writeInvio({ invio_ps_note: e.target.value })
              }}
            />
          </label>
        </div>
      </div>
    </section>
  )
}
