import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { keycloakify } from 'keycloakify/vite-plugin';
import { defineConfig } from 'vite';

// Keycloakify turns this React app into a Keycloak login theme ("agricoop"). `pnpm dev` previews
// every page with mock contexts (src/main.tsx); `pnpm keycloak:theme` (repo root) builds the JAR.
export default defineConfig({
  // Dev preview (mock contexts); 5173/5174 are the storefront and the back office.
  server: { port: 5176, strictPort: true },
  plugins: [
    react(),
    tailwindcss(),
    keycloakify({
      themeName: 'agricoop',
      accountThemeImplementation: 'none',
      // Keycloak 26 only (the realm runs 26.8): one JAR.
      keycloakVersionTargets: {
        '22-to-25': false,
        'all-other-versions': 'agricoop-keycloak-theme.jar',
      },
      artifactId: 'agricoop-keycloak-theme',
      groupId: 'ma.agricoop.keycloak',
    }),
  ],
});
