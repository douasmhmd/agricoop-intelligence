import './i18n';
import './index.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { WebStorageStateStore } from 'oidc-client-ts';
import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider, type AuthProviderProps, useAuth } from 'react-oidc-context';
import { ApiError, setAccessTokenProvider, setCoopHeaderProvider } from './api/fetcher';
import { useSession } from './auth/session';
import { Toaster } from './components/ui/sonner';
import { config } from './config';
import { routeTree } from './routeTree.gen';
import { PreferencesProvider, usePreferences } from './state/preferences';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      // Do not retry what will not change by retrying (auth, validation, not found, conflicts).
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
    },
  },
});

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  scrollRestoration: true,
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
  // Tokens live in sessionStorage (not localStorage): gone when the tab closes.
  userStore: new WebStorageStateStore({ store: window.sessionStorage }),
  onSigninCallback: () => {
    window.history.replaceState({}, document.title, window.location.pathname);
  },
};

/** Feeds the fetch mutator with the current token and, for saas_admin, the chosen cooperative. */
function ApiBridge() {
  const auth = useAuth();
  const session = useSession();
  const { adminCoopId } = usePreferences();
  setAccessTokenProvider(() => auth.user?.access_token);
  setCoopHeaderProvider(() => (session?.isAdmin ? adminCoopId : undefined));
  useEffect(() => {
    // Another tenant means other data: drop every cached query.
    queryClient.removeQueries();
  }, [adminCoopId]);
  return null;
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('#root element missing from index.html');

createRoot(rootElement).render(
  <StrictMode>
    <AuthProvider {...oidc}>
      <PreferencesProvider>
        <QueryClientProvider client={queryClient}>
          <ApiBridge />
          <RouterProvider router={router} />
          <Toaster position="top-center" richColors />
        </QueryClientProvider>
      </PreferencesProvider>
    </AuthProvider>
  </StrictMode>,
);
