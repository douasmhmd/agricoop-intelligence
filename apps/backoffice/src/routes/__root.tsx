import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { hasAuthParams, useAuth } from 'react-oidc-context';
import { useSession } from '@/auth/session';
import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/ui/button';

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
      <div className="flex min-h-dvh items-center justify-center gap-2 text-muted-foreground">
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
          <>
            <Loader2 className="size-5 animate-spin" /> {t('auth.signingIn')}
          </>
        )}
      </div>
    );
  }

  if (!session?.isManager && !session?.isAdmin) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
        <ShieldAlert className="size-8 text-amber-600" />
        <p className="max-w-md">{t('auth.forbidden')}</p>
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
  return <p className="text-muted-foreground">{t('notFound')}</p>;
}
