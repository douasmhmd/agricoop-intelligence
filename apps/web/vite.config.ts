import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// In development the API services are reached through the Vite proxy so the browser only ever talks
// to one origin, exactly like behind the ingress in production (/api/v1 -> api, /qr/v1 -> qr).
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': process.env.API_URL ?? 'http://localhost:3000',
      '/qr': process.env.QR_URL ?? 'http://localhost:3001',
    },
  },
  preview: { port: 5173 },
});
