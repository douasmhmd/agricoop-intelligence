import '@agricoop/ui/fonts';
import './index.css';
import { MotionProvider, ThemeProvider } from '@agricoop/ui';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { KcPage } from './kc.gen';

const root = document.getElementById('root');
if (!root) throw new Error('#root missing');

function render() {
  createRoot(root!).render(
    <StrictMode>
      <ThemeProvider>
        <MotionProvider>
          {window.kcContext ? (
            <KcPage kcContext={window.kcContext} />
          ) : (
            <p className="p-8 text-muted-foreground">No Keycloak context.</p>
          )}
        </MotionProvider>
      </ThemeProvider>
    </StrictMode>,
  );
}

// Dev preview without Keycloak: `pnpm --filter @agricoop/keycloak-theme dev`, then e.g.
// /?page=login.ftl&lang=ar&state=error (src/login/preview.ts). Never part of the built theme.
if (import.meta.env.DEV && !window.kcContext) {
  void import('./login/preview').then(({ previewKcContext }) => {
    window.kcContext = previewKcContext(new URLSearchParams(window.location.search));
    render();
  });
} else {
  render();
}
