// First: records whether the pre-rendered home shell is on screen (before React replaces it).
import { bootedOverShell } from './lib/prerender';
import './i18n';
import '@agricoop/ui/fonts';
import './index.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { WebStorageStateStore } from 'oidc-client-ts';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider, type AuthProviderProps, useAuth } from 'react-oidc-context';
import { ApiError, setAccessTokenProvider } from './api/fetcher';
import { safeReturnPath } from './auth/return-path';
import { SessionNotices } from './auth/SessionNotices';
import { CartProvider } from './cart/cart';
import { MotionProvider, ThemeProvider, Toaster } from '@agricoop/ui';
import { config } from './config';
import { routeTree } from './routeTree.gen';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
    },
  },
});

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  scrollRestoration: true,
  // Native cross-fade / shared-element morphs between pages where the browser supports it.
  defaultViewTransition: true,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const oidc: AuthProviderProps = {
  authority: config.oidcAuthority,
  client_id: config.oidcClientId,
  redirect_uri: `${window.location.origin}/`,
  post_logout_redirect_uri: `${window.location.origin}/`,
  scope: 'openid profile email',
  automaticSilentRenew: true,
  userStore: new WebStorageStateStore({ store: window.sessionStorage }),
  onSigninCallback: (user) => {
    router.history.replace(
      safeReturnPath((user?.state as { returnTo?: unknown } | undefined)?.returnTo),
    );
  },
};

/** Feeds the fetch mutator with the customer's token (anonymous browsing sends none). */
function ApiBridge() {
  const auth = useAuth();
  setAccessTokenProvider(() => auth.user?.access_token);
  return null;
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('#root element missing from index.html');

// Over the pre-rendered shell, render once the home route (lazy chunk) is ready, so React swaps
// the shell for the same content in one commit instead of flashing an empty page.
if (bootedOverShell) await router.load();

createRoot(rootElement).render(
  <StrictMode>
    <ThemeProvider>
      <MotionProvider>
        <AuthProvider {...oidc}>
          <QueryClientProvider client={queryClient}>
            <CartProvider>
              <ApiBridge />
              <RouterProvider router={router} />
              {/* Bottom on phones: a top toast would cover the header (cart, account). */}
              <Toaster position="bottom-center" richColors />
              <SessionNotices />
            </CartProvider>
          </QueryClientProvider>
        </AuthProvider>
      </MotionProvider>
    </ThemeProvider>
  </StrictMode>,
);
