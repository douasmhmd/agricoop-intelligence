import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Link, Outlet } from '@tanstack/react-router';
import { ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SiteHeader } from '@/components/SiteHeader';

export interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFound,
});

function RootLayout() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-5">
        <Outlet />
      </main>
      <footer className="border-t py-5 text-center text-sm text-muted-foreground">
        <p className="inline-flex items-center gap-1.5">
          <ShieldCheck className="size-4" /> {t('footer.verify')}
        </p>
      </footer>
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
