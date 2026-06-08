import { useState, useEffect, useCallback } from 'react'
import type { ParametroVitaleRilevazione } from '@pma/types/cartellaClinica'
import type { Paziente } from '@pma/types/paziente'
import type { UserProfile } from '@pma/types/userProfile'
import { mirrorTriagePvRowToCartellaSafe } from '@pma/lib/triagePvCartellaBackup'
import { PmaFieldGuard } from '../PmaFieldGuard'
import { ParametriVitaliPanel } from './ParametriVitaliPanel'

export type TriageSectionProps = {
  pazienteId: string
  p: Paziente
  canEdit: boolean
  write: (patch: Record<string, unknown>) => Promise<void>
  user: UserProfile | null
  embedded?: boolean
}

export function TriageSection({ pazienteId, p, canEdit, write, user }: TriageSectionProps) {
  const [noteDraft, setNoteDraft] = useState(p.triage_note ?? '')
  const [noteFocused, setNoteFocused] = useState(false)

  useEffect(() => {
    if (!noteFocused) {
      setNoteDraft(p.triage_note ?? '')
    }
  }, [p.triage_note, noteFocused])

  const backupPvRowToCartella = useCallback(
    (row: ParametroVitaleRilevazione) => {
      mirrorTriagePvRowToCartellaSafe(p.id_manifestazione, pazienteId, row)
    },
    [p.id_manifestazione, pazienteId],
  )

  return (
    <div className="space-y-0">
      <ParametriVitaliPanel
        pazienteId={pazienteId}
        manifestationId={p.id_manifestazione}
        rows={p.triage_parametri_vitali}
        arrayField="triage_parametri_vitali"
        fieldGuardKey="triage_parametri_vitali"
        canEdit={canEdit}
        write={write}
        user={user}
        title="Parametri vitali"
        onRowCommitted={backupPvRowToCartella}
      />

      <PmaFieldGuard fieldKey="triage_note">
        <div className="border-b border-slate-200 bg-slate-50/80 px-3 py-2 text-sm font-bold text-slate-900 sm:px-3">
          Note triage
        </div>
        <div className="p-3">
          <textarea
            rows={8}
            disabled={!canEdit}
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            onFocus={() => setNoteFocused(true)}
            onBlur={() => {
              setNoteFocused(false)
              const next = noteDraft.trim()
              if (next !== String(p.triage_note ?? '').trim()) {
                void write({ triage_note: next })
              }
            }}
            placeholder="Note di triage…"
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 disabled:bg-slate-100"
          />
        </div>
      </PmaFieldGuard>
    </div>
  )
}
