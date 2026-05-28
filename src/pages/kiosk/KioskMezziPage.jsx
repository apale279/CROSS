import { useReadOnlyMode } from '../../hooks/useReadOnlyMode';
import { useOperativoDashboardData } from '../../hooks/useOperativoDashboardData';
import { StatoMezziTable } from '../../components/dashboard/StatoMezziTable';
import { KioskPageHeader } from '../../components/kiosk/KioskPageHeader';
import { useKioskScheda } from '../../context/KioskSchedaContext';

export default function KioskMezziPage() {
  const readOnly = useReadOnlyMode();
  const { openMezzo } = useKioskScheda();
  const { mezziSorted, loading } = useOperativoDashboardData({ autoReconcileOperativo: false });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <KioskPageHeader title="Stato mezzi" panelId="mezzi" />
      <div className="min-h-0 flex-1 overflow-auto">
        <StatoMezziTable
          loading={loading}
          mezzi={mezziSorted}
          readOnly={readOnly}
          onOpenMezzo={openMezzo}
        />
      </div>
    </div>
  );
}
