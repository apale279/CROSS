import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiProxyTarget = env.VITE_API_BASE_URL?.trim();

  return {
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5320,
    strictPort: true,
    open: false,
    proxy: apiProxyTarget
      ? {
          '/api': {
            target: apiProxyTarget,
            changeOrigin: true,
            secure: true,
          },
        }
      : undefined,
  },
  preview: {
    host: true,
    port: 4173,
  },
};
});
