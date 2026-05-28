import { useOperativoDashboardData } from '../../hooks/useOperativoDashboardData';
import { DashboardPmaPanel } from '../../components/dashboard/DashboardPmaPanel';
import { KioskPageHeader } from '../../components/kiosk/KioskPageHeader';

export default function KioskPmaPage() {
  const { pazienti, loading } = useOperativoDashboardData({ autoReconcileOperativo: false });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <KioskPageHeader title="Dashboard PMA" panelId="pma" />
      <div className="min-h-0 flex-1 overflow-hidden">
        <DashboardPmaPanel pazienti={pazienti} loading={loading} />
      </div>
    </div>
  );
}
