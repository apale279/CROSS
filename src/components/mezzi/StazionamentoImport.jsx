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
            title={
              [st.tipo_stazionamento, st.note, st.indirizzo].filter(Boolean).join(' · ') || st.nome
            }
            onClick={() =>
              onImport({
                indirizzo: st.indirizzo ?? '',
                coordinate: st.coordinate ?? null,
                luogo_fisico: st.luogo_fisico ?? '',
                note: st.note ?? '',
              })
            }
          >
            {st.nome}
            {st.tipo_stazionamento ? (
              <span className="ml-1 font-normal opacity-80">({st.tipo_stazionamento})</span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
