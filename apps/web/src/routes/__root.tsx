import type { QueryClient } from '@tanstack/react-query';
import { Button, ZelligeBackdrop } from '@agricoop/ui';
import {
  createRootRouteWithContext,
  type ErrorComponentProps,
  Link,
  Outlet,
  useRouterState,
} from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { CartDrawerProvider } from '@/cart/CartDrawer';
import { FlyToCartProvider } from '@/cart/fly';
import { useErrorMessage } from '@/components/common';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { SmoothScroll } from '@/components/SmoothScroll';

export interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFound,
  errorComponent: RouteError,
});

function RootLayout() {
  // The home page is full-bleed (hero under the transparent header); other pages sit in a
  // centred column below the fixed header.
  const isHome = useRouterState({ select: (s) => s.location.pathname === '/' });
  return (
    <FlyToCartProvider>
      <CartDrawerProvider>
        <div className="flex min-h-dvh flex-col">
          <SmoothScroll />
          <SiteHeader />
          <main
            className={
              isHome
                ? 'flex-1'
                : 'mx-auto w-full max-w-7xl flex-1 px-4 pt-24 pb-20 sm:px-6 lg:px-8 lg:pt-28'
            }
          >
            <Outlet />
          </main>
          <SiteFooter />
        </div>
      </CartDrawerProvider>
    </FlyToCartProvider>
  );
}

/** Shared look of the 404 and error pages: an arch with the zellige lattice and a big serif mark. */
function LostLayout({
  mark,
  title,
  text,
  action,
}: {
  mark: string;
  title: string;
  text: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center py-10 text-center sm:py-16">
      <div className="arch relative isolate grid h-56 w-44 place-items-center border bg-card shadow-lifted">
        <ZelligeBackdrop className="-z-10" fade="none" />
        <span className="font-display text-6xl font-semibold text-primary">{mark}</span>
      </div>
      <h1 className="mt-10 font-display text-display-md font-semibold">{title}</h1>
      <p className="mt-3 max-w-md text-muted-foreground">{text}</p>
      <div className="mt-8">{action}</div>
    </div>
  );
}

function NotFound() {
  const { t } = useTranslation();
  return (
    <LostLayout
      mark="404"
      title={t('notFound')}
      text={t('lost.text')}
      action={
        <Button asChild size="lg" shape="pill" variant="gold">
          <Link to="/">{t('nav.home')}</Link>
        </Button>
      }
    />
  );
}

function RouteError({ error, reset }: ErrorComponentProps) {
  const { t } = useTranslation();
  const message = useErrorMessage();
  return (
    <LostLayout
      mark="!"
      title={t('lost.errorTitle')}
      text={message(error)}
      action={
        <Button size="lg" shape="pill" onClick={reset}>
          {t('lost.retry')}
        </Button>
      }
    />
  );
}
