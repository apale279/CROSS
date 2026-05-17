import { useReadOnlyMode } from '../../hooks/useReadOnlyMode';
import { useOperativoDashboardData } from '../../hooks/useOperativoDashboardData';
import { OpsMap } from '../../components/dashboard/OpsMap';
import { KioskPageHeader } from '../../components/kiosk/KioskPageHeader';
import { useKioskScheda } from '../../context/KioskSchedaContext';

export default function KioskMappaPage() {
  const readOnly = useReadOnlyMode();
  const { openEvento, openMezzo } = useKioskScheda();
  const { eventiAperti, mezzi } = useOperativoDashboardData();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <KioskPageHeader title="Mappa" panelId="mappa" />
      <div className="min-h-0 flex-1">
        <OpsMap
          eventi={eventiAperti}
          mezzi={mezzi}
          readOnly={readOnly}
          onSelect={(payload) => {
            if (payload.type === 'evento') openEvento(payload.data);
            if (payload.type === 'mezzo') openMezzo(payload.data);
          }}
        />
      </div>
    </div>
  );
}
