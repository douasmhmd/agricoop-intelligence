import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Link, Outlet, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { SmoothScroll } from '@/components/SmoothScroll';

export interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFound,
});

function RootLayout() {
  // The home page is full-bleed (hero under the transparent header); other pages sit in a
  // centred column below the fixed header.
  const isHome = useRouterState({ select: (s) => s.location.pathname === '/' });
  return (
    <div className="flex min-h-dvh flex-col">
      <SmoothScroll />
      <SiteHeader />
      <main
        className={
          isHome ? 'flex-1' : 'mx-auto w-full max-w-5xl flex-1 px-4 pt-24 pb-16 sm:px-6 lg:pt-28'
        }
      >
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}

function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="py-12 text-center">
      <p className="text-muted-foreground">{t('notFound')}</p>
      <Link to="/" className="mt-3 inline-block text-primary underline">
        {t('nav.home')}
      </Link>
    </div>
  );
}
