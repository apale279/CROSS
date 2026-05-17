import { useSearchParams } from 'react-router-dom';
import { useImpostazioni } from '../../hooks/useImpostazioni';
import { useReadOnlyMode } from '../../hooks/useReadOnlyMode';
import { useOperativoDashboardData } from '../../hooks/useOperativoDashboardData';
import { EventiMissioniTable } from '../../components/dashboard/EventiMissioniTable';
import { KioskPageHeader } from '../../components/kiosk/KioskPageHeader';
import { useKioskScheda } from '../../context/KioskSchedaContext';

export default function KioskEventiPage() {
  const readOnly = useReadOnlyMode();
  const { openEvento, openMissione } = useKioskScheda();
  const [searchParams] = useSearchParams();
  const eventoIdFilter = searchParams.get('eventoId')?.trim() || '';
  const { impostazioni } = useImpostazioni();
  const telegramEnabled = impostazioni?.telegramBotEnabled === true;
  const {
    eventiAperti,
    operativoBlocks,
    pazientiCountByEvento,
    loading,
  } = useOperativoDashboardData();

  const blocks = eventoIdFilter
    ? operativoBlocks.filter((b) => b.ev?._docId === eventoIdFilter)
    : operativoBlocks;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <KioskPageHeader title="Eventi e missioni" panelId="operativo" />
      <div className="min-h-0 flex-1 overflow-auto p-1">
        <EventiMissioniTable
          loading={loading}
          blocks={blocks}
          pazientiCountByEvento={pazientiCountByEvento}
          eventi={eventiAperti}
          telegramEnabled={telegramEnabled}
          readOnly={readOnly}
          onOpenEvento={openEvento}
          onOpenMissione={openMissione}
        />
      </div>
    </div>
  );
}
