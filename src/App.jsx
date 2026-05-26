import { Navigate, Route, Routes } from 'react-router-dom';
import { AppDataShell } from './components/routing/AppDataShell';
import { LegacyManifestazioneRedirect } from './components/routing/LegacyManifestazioneRedirect';
import { RequireAuth } from './components/auth/RequireAuth';
import { PmaAccessRouter } from './components/auth/PmaAccessRouter';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { KioskLayout } from './components/layout/KioskLayout';
import { DefaultHomeRoute } from './components/routing/DefaultHomeRoute';
import KioskEventiPage from './pages/kiosk/KioskEventiPage';
import KioskMezziPage from './pages/kiosk/KioskMezziPage';
import KioskMappaPage from './pages/kiosk/KioskMappaPage';
import KioskPmaPage from './pages/kiosk/KioskPmaPage';
import EventiPage from './pages/EventiPage';
import MezziPage from './pages/MezziPage';
import MissioniPage from './pages/MissioniPage';
import ImpostazioniPage from './pages/ImpostazioniPage';
import PazientiPage from './pages/PazientiPage';
import DiarioPage from './pages/DiarioPage';
import AccountPage from './pages/AccountPage';
import LoginPage from './pages/LoginPage';
import PmaSelectPage from './pages/PmaSelectPage';
import PmaDeskPage from './pages/PmaDeskPage';
import PmaPazientePage from './pages/PmaPazientePage';
import PmaIpadFirmaPage from './pages/PmaIpadFirmaPage';

export default function App() {
  return (
    <Routes>
      <Route
        path="manifestazione/:manifestationId/*"
        element={<LegacyManifestazioneRedirect />}
      />
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AppDataShell />}>
        <Route path="pma-ipad/:pmaId" element={<PmaIpadFirmaPage />} />
      </Route>
      <Route element={<RequireAuth />}>
        <Route element={<AppDataShell />}>
          <Route element={<PmaAccessRouter />}>
            <Route
              path="pma/:pmaId/paziente/:pazienteDocId"
              element={<PmaPazientePage />}
            />
            <Route element={<DashboardLayout />}>
              <Route index element={<DefaultHomeRoute />} />
              <Route path="diario" element={<DiarioPage />} />
              <Route path="account" element={<AccountPage />} />
              <Route path="eventi" element={<EventiPage />} />
              <Route path="mezzi" element={<MezziPage />} />
              <Route path="missioni" element={<MissioniPage />} />
              <Route path="pazienti" element={<PazientiPage />} />
              <Route path="impostazioni" element={<ImpostazioniPage />} />
              <Route path="pma" element={<PmaSelectPage />} />
              <Route path="pma/:pmaId" element={<PmaDeskPage />} />
            </Route>
          </Route>
          <Route element={<KioskLayout />}>
            <Route path="kiosk/eventi" element={<KioskEventiPage />} />
            <Route path="kiosk/mezzi" element={<KioskMezziPage />} />
            <Route path="kiosk/mappa" element={<KioskMappaPage />} />
            <Route path="kiosk/pma" element={<KioskPmaPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
