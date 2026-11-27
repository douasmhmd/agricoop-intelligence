import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Link, Outlet } from '@tanstack/react-router';
import { CircleAlert, Compass, LogIn, LogOut, ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { hasAuthParams, useAuth } from 'react-oidc-context';
import { useSession } from '@/auth/session';
import { AppShell } from '@/components/AppShell';
import { AuthScreen, Button } from '@agricoop/ui';
import { consumeSignedOut, signOut } from '@/auth/sign-out';
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
  // Back from Keycloak's logout: stay on a "signed out" screen instead of signing in again.
  const [signedOut] = useState(consumeSignedOut);

  useEffect(() => {
    if (
      !signedOut &&
      !hasAuthParams() &&
      !auth.isAuthenticated &&
      !auth.activeNavigator &&
      !auth.isLoading &&
      !auth.error
    ) {
      void auth.signinRedirect({ state: { returnTo: currentPath() } });
    }
  }, [auth, signedOut]);

  if (signedOut && !auth.isAuthenticated && !auth.activeNavigator) {
    return (
      <AuthScreen
        fullScreen
        icon={LogOut}
        mirrorIcon
        title={t('auth.signedOut')}
        description={t('auth.signedOutHint')}
      >
        <Button onClick={() => void auth.signinRedirect({ state: { returnTo: '/' } })}>
          <LogIn className="rtl:rotate-180" /> {t('auth.signInAgain')}
        </Button>
      </AuthScreen>
    );
  }

  // Same look as the Keycloak login theme: app → Keycloak → app feels like one place.
  if (auth.isLoading || auth.activeNavigator || !auth.isAuthenticated) {
    return auth.error ? (
      <AuthScreen
        fullScreen
        tone="danger"
        icon={CircleAlert}
        title={t('auth.errorTitle')}
        description={t('auth.error')}
      >
        <Button onClick={() => void auth.signinRedirect({ state: { returnTo: currentPath() } })}>
          <LogIn className="rtl:rotate-180" /> {t('auth.signIn')}
        </Button>
      </AuthScreen>
    ) : (
      <AuthScreen fullScreen busy title={t('auth.redirecting')} description={t('auth.signingIn')} />
    );
  }

  if (!session?.isManager && !session?.isAdmin) {
    return (
      <AuthScreen
        fullScreen
        tone="warning"
        icon={ShieldAlert}
        title={t('auth.forbiddenTitle')}
        description={t('auth.forbidden')}
      >
        <Button variant="outline" onClick={() => signOut(auth)}>
          <LogOut className="rtl:rotate-180" /> {t('auth.signOut')}
        </Button>
      </AuthScreen>
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
