import { Timestamp } from 'firebase/firestore'

export function toYmd(ts: Timestamp | null | undefined): string {
  if (!ts || typeof ts.toDate !== 'function') return ''
  const d = ts.toDate()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function toDatetimeLocal(ts: Timestamp | null | undefined): string {
  if (!ts || typeof ts.toDate !== 'function') return ''
  const d = ts.toDate()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export function ymdToTimestamp(ymd: string): Timestamp | null {
  if (!ymd) return null
  const [y, m, d] = ymd.split('-').map((x) => Number(x))
  if (!y || !m || !d) return null
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0)
  if (Number.isNaN(dt.getTime())) return null
  return Timestamp.fromDate(dt)
}

export function datetimeLocalToTimestamp(v: string): Timestamp | null {
  if (!v) return null
  const dt = new Date(v)
  if (Number.isNaN(dt.getTime())) return null
  return Timestamp.fromDate(dt)
}
