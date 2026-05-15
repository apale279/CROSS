import { btnSecondary } from '../ui/FormField';

export function StazionamentoImport({ stazionamenti, onImport }) {
  const list = stazionamenti ?? [];
  if (list.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-slate-600">Stazionamenti da impostazioni</p>
      <div className="flex flex-wrap gap-2">
        {list.map((st) => (
          <button
            key={st.id}
            type="button"
            className={`${btnSecondary} text-sm`}
            title={st.indirizzo || st.nome}
            onClick={() =>
              onImport({
                indirizzo: st.indirizzo ?? '',
                coordinate: st.coordinate ?? null,
              })
            }
          >
            {st.nome}
          </button>
        ))}
      </div>
    </div>
  );
}
