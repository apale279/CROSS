import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useMemo } from 'react';
import { useImpostazioni } from '../hooks/useImpostazioni';
import { usePmaAccess } from '../hooks/usePmaAccess';
import { findPmaById } from '../lib/pmaModule';
import { PmaSchedaShell } from '../pma/components/PmaSchedaShell';

/** Pagina PMA a tutto schermo (anagrafica, dati centrale, cartella, dimissioni). */
export default function PmaPazientePage() {
  const { pmaId, pazienteDocId } = useParams();
  const navigate = useNavigate();
  const decodedPmaId = decodeURIComponent(pmaId ?? '');
  const docId = decodeURIComponent(pazienteDocId ?? '');
  const { impostazioni } = useImpostazioni();
  const { scopeId, accessiblePma } = usePmaAccess();

  const pma = useMemo(
    () => findPmaById(impostazioni, decodedPmaId),
    [impostazioni, decodedPmaId],
  );

  if (!pma) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8 text-sm text-slate-600">
        PMA non trovato. <Link to="/pma">Torna all&apos;elenco</Link>
      </div>
    );
  }

  if (scopeId && scopeId !== pma.id) {
    return <Navigate to={`/pma/${encodeURIComponent(scopeId)}`} replace />;
  }

  if (!accessiblePma.some((x) => x.id === pma.id)) {
    return <Navigate to="/pma" replace />;
  }

  return (
    <div className="pma-viewport fixed inset-0 z-50 flex min-w-0 flex-col bg-slate-100">
      <PmaSchedaShell
        pazienteDocId={docId}
        pmaId={pma.id}
        pmaNome={pma.nome}
        onClose={() => navigate(`/pma/${encodeURIComponent(pma.id)}`)}
      />
    </div>
  );
}
