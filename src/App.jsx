import { Navigate, Route, Routes } from 'react-router-dom';
import { AppDataShell } from './components/routing/AppDataShell';
import { LegacyManifestazioneRedirect } from './components/routing/LegacyManifestazioneRedirect';
import { RequireAuth } from './components/auth/RequireAuth';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { KioskLayout } from './components/layout/KioskLayout';
import DashboardPage from './pages/DashboardPage';
import KioskEventiPage from './pages/kiosk/KioskEventiPage';
import KioskMezziPage from './pages/kiosk/KioskMezziPage';
import KioskMappaPage from './pages/kiosk/KioskMappaPage';
import EventiPage from './pages/EventiPage';
import MezziPage from './pages/MezziPage';
import MissioniPage from './pages/MissioniPage';
import ImpostazioniPage from './pages/ImpostazioniPage';
import PazientiPage from './pages/PazientiPage';
import DiarioPage from './pages/DiarioPage';
import LoginPage from './pages/LoginPage';

export default function App() {
  return (
    <Routes>
      <Route
        path="manifestazione/:manifestationId/*"
        element={<LegacyManifestazioneRedirect />}
      />
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppDataShell />}>
          <Route element={<DashboardLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="diario" element={<DiarioPage />} />
            <Route path="eventi" element={<EventiPage />} />
            <Route path="mezzi" element={<MezziPage />} />
            <Route path="missioni" element={<MissioniPage />} />
            <Route path="pazienti" element={<PazientiPage />} />
            <Route path="impostazioni" element={<ImpostazioniPage />} />
          </Route>
          <Route element={<KioskLayout />}>
            <Route path="kiosk/eventi" element={<KioskEventiPage />} />
            <Route path="kiosk/mezzi" element={<KioskMezziPage />} />
            <Route path="kiosk/mappa" element={<KioskMappaPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
