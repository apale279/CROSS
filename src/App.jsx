import { Navigate, Route, Routes } from 'react-router-dom';
import { AppDataShell } from './components/routing/AppDataShell';
import { LegacyManifestazioneRedirect } from './components/routing/LegacyManifestazioneRedirect';
import { RequireAuth } from './components/auth/RequireAuth';
import { DashboardLayout } from './components/layout/DashboardLayout';
import DashboardPage from './pages/DashboardPage';
import EventiPage from './pages/EventiPage';
import MezziPage from './pages/MezziPage';
import MissioniPage from './pages/MissioniPage';
import ImpostazioniPage from './pages/ImpostazioniPage';
import PazientiPage from './pages/PazientiPage';
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
            <Route path="eventi" element={<EventiPage />} />
            <Route path="mezzi" element={<MezziPage />} />
            <Route path="missioni" element={<MissioniPage />} />
            <Route path="pazienti" element={<PazientiPage />} />
            <Route path="impostazioni" element={<ImpostazioniPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
