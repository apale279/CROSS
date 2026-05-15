export function formatDate(ts) {
  if (!ts) return '—';
  const date = ts?.toDate ? ts.toDate() : new Date(ts);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatTimestamp(ts) {
  if (!ts) return '—';
  const date = ts?.toDate ? ts.toDate() : new Date(ts);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatElapsed(ms) {
  if (ms == null || ms < 0) return '—';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, '0')}s`;
  return `${sec}s`;
}

export function coloreBadgeClass(colore) {
  const map = {
    Bianco: 'bg-white border-slate-400 text-slate-800',
    Verde: 'bg-emerald-100 text-emerald-900 border-emerald-400',
    Giallo: 'bg-amber-100 text-amber-900 border-amber-400',
    Rosso: 'bg-red-100 text-red-900 border-red-400',
  };
  return map[colore] ?? map.Bianco;
}

export function coloreRowBgSoft(colore) {
  const map = {
    Bianco: 'bg-slate-50/90',
    Verde: 'bg-emerald-50/90',
    Giallo: 'bg-amber-50/90',
    Rosso: 'bg-red-50/90',
  };
  return map[colore] ?? map.Bianco;
}

export function coloreHex(colore) {
  const map = {
    Bianco: '#f8fafc',
    Verde: '#22c55e',
    Giallo: '#eab308',
    Rosso: '#ef4444',
  };
  return map[colore] ?? map.Bianco;
}

export function statoMissioneBadgeClass(stato) {
  const map = {
    ALLERTARE: 'bg-red-100 text-red-900 border-red-300',
    ALLERTATO: 'bg-orange-100 text-orange-900 border-orange-300',
    PARTITO: 'bg-amber-100 text-amber-900 border-amber-300',
    'IN POSTO': 'bg-sky-100 text-sky-900 border-sky-300',
    'DIRETTO H': 'bg-violet-100 text-violet-900 border-violet-300',
    'ARRIVATO H': 'bg-indigo-100 text-indigo-900 border-indigo-300',
    RIENTRO: 'bg-teal-100 text-teal-900 border-teal-300',
    'FINE MISSIONE': 'bg-slate-200 text-slate-700 border-slate-400',
    ANNULLATA: 'bg-stone-200 text-stone-900 border-stone-500',
  };
  return map[stato] ?? 'bg-slate-100 text-slate-800 border-slate-300';
}

export function mezzoRowClass(mezzo) {
  const disponibile = (mezzo.statoMezzo ?? 'Disponibile') === 'Disponibile';
  const operativo = mezzo.operativo !== false;
  if (disponibile && operativo) return 'bg-emerald-50/80 hover:bg-emerald-100/80';
  if (!operativo) return 'bg-red-50/60 hover:bg-red-100/60';
  return 'bg-slate-100 hover:bg-slate-200/80';
}
