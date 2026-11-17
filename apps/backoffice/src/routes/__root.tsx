import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Link, Outlet } from '@tanstack/react-router';
import { Compass, Loader2, ShieldAlert } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { hasAuthParams, useAuth } from 'react-oidc-context';
import { useSession } from '@/auth/session';
import { AppShell } from '@/components/AppShell';
import { BrandMark, Button, ZelligeBackdrop } from '@agricoop/ui';
import { EmptyState } from '@/components/common';

export interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: Root,
  notFoundComponent: NotFound,
});

const currentPath = () => `${window.location.pathname}${window.location.search}`;

/** The whole back office requires a signed-in coop_manager or saas_admin. */
function Root() {
  const auth = useAuth();
  const session = useSession();
  const { t } = useTranslation();

  useEffect(() => {
    if (
      !hasAuthParams() &&
      !auth.isAuthenticated &&
      !auth.activeNavigator &&
      !auth.isLoading &&
      !auth.error
    ) {
      void auth.signinRedirect({ state: { returnTo: currentPath() } });
    }
  }, [auth]);

  if (auth.isLoading || auth.activeNavigator || !auth.isAuthenticated) {
    return (
      <div className="relative isolate flex min-h-dvh flex-col items-center justify-center gap-4 overflow-hidden bg-background text-muted-foreground">
        <ZelligeBackdrop />
        <BrandMark className="size-10 text-primary" />
        {auth.error ? (
          <div className="grid gap-3 text-center">
            <p>{t('auth.error')}</p>
            <Button
              onClick={() => void auth.signinRedirect({ state: { returnTo: currentPath() } })}
            >
              {t('auth.signIn')}
            </Button>
          </div>
        ) : (
          <p className="flex items-center gap-2 text-sm" role="status">
            <Loader2 className="size-4 animate-spin" aria-hidden /> {t('auth.signingIn')}
          </p>
        )}
      </div>
    );
  }

  if (!session?.isManager && !session?.isAdmin) {
    return (
      <div className="relative isolate flex min-h-dvh flex-col items-center justify-center gap-4 overflow-hidden bg-background p-6 text-center">
        <ZelligeBackdrop />
        <span className="grid size-14 place-items-center rounded-full border bg-card text-warning-foreground shadow-soft dark:text-warning">
          <ShieldAlert className="size-6" aria-hidden />
        </span>
        <p className="max-w-md text-muted-foreground">{t('auth.forbidden')}</p>
        <Button variant="outline" onClick={() => void auth.signoutRedirect()}>
          {t('auth.signOut')}
        </Button>
      </div>
    );
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

function NotFound() {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon={Compass}
      title={t('notFound')}
      action={
        <Button asChild size="sm" variant="outline">
          <Link to="/">{t('nav.dashboard')}</Link>
        </Button>
      }
    >
      {t('notFoundHint')}
    </EmptyState>
  );
}
