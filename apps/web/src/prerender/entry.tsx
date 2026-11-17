/*
 * Build-time render of the home page's first screen (header + hero), injected into index.html by
 * scripts/prerender.mjs. Same components and markup as the live app (routes/__root.tsx layout),
 * rendered in French with an anonymous visitor and an empty cart; React replaces it on boot.
 * Not part of the client bundle.
 */
import '@/i18n';
import { MotionProvider } from '@agricoop/ui';
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { renderToString } from 'react-dom/server';
import { AuthContext, type AuthContextProps } from 'react-oidc-context';
import { CartProvider } from '@/cart/cart';
import { SiteHeader } from '@/components/SiteHeader';
import { Hero } from '@/home/Hero';

function Shell() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Hero />
      </main>
    </div>
  );
}

// Anonymous visitor whose session is still being restored: the header shows "Se connecter",
// exactly like the live app's first render.
const anonymous = {
  isAuthenticated: false,
  isLoading: true,
  user: null,
  activeNavigator: undefined,
  error: undefined,
} as unknown as AuthContextProps; // justification: only the read-only state fields are used here

export async function render(): Promise<string> {
  const router = createRouter({
    routeTree: createRootRoute({ component: Shell }),
    history: createMemoryHistory({ initialEntries: ['/'] }),
    isServer: true,
  });
  await router.load();
  return renderToString(
    <MotionProvider>
      <AuthContext.Provider value={anonymous}>
        <CartProvider>
          <RouterProvider router={router} />
        </CartProvider>
      </AuthContext.Provider>
    </MotionProvider>,
  );
}
