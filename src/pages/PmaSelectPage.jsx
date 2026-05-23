import { Link } from 'react-router-dom';
import { usePmaAccess } from '../hooks/usePmaAccess';
import { btnPrimary } from '../components/ui/FormField';

export default function PmaSelectPage() {
  const { accessiblePma, loading, scopeId } = usePmaAccess();

  if (loading) {
    return <p className="p-8 text-sm text-slate-500">Caricamento PMA…</p>;
  }

  if (scopeId && accessiblePma.length === 1) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center">
        <Link
          to={`/pma/${encodeURIComponent(scopeId)}`}
          className={btnPrimary}
        >
          Apri {accessiblePma[0].nome}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold text-slate-900">Vista PMA</h1>
      <p className="mb-6 text-sm text-slate-600">
        Scegli il posto medico avanzato da gestire. Gli operatori con accesso limitato vedono solo il
        PMA assegnato al profilo.
      </p>
      {accessiblePma.length === 0 ? (
        <p className="text-sm text-amber-800">Nessun PMA configurato in impostazioni.</p>
      ) : (
        <ul className="space-y-2">
          {accessiblePma.map((p) => (
            <li key={p.id}>
              <Link
                to={`/pma/${encodeURIComponent(p.id)}`}
                className="block rounded-lg border border-violet-200 bg-white px-4 py-3 font-semibold text-violet-900 shadow-sm hover:bg-violet-50"
              >
                {p.nome}
                <span className="mt-1 block font-mono text-xs font-normal text-slate-500">
                  ID accesso: {p.id}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
