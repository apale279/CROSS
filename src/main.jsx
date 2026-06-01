import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { TenantProvider } from './context/TenantContext';
import { SandboxUiProvider } from './context/SandboxUiContext';
import { AuthProvider } from './context/AuthContext';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <TenantProvider>
        <SandboxUiProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </SandboxUiProvider>
      </TenantProvider>
    </BrowserRouter>
  </StrictMode>,
);
