import { AuthScreen, Button } from '@agricoop/ui';
import { LogIn } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from 'react-oidc-context';

/** Customer pages (checkout, account, orders): sign in first, then come back to the same page. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const { t } = useTranslation();
  if (auth.isLoading || auth.activeNavigator) {
    return <AuthScreen busy title={t('auth.redirecting')} />;
  }
  if (!auth.isAuthenticated) {
    return (
      <AuthScreen
        icon={LogIn}
        mirrorIcon
        title={t('auth.required')}
        description={t('auth.registerHint')}
      >
        <Button
          size="xl"
          shape="pill"
          variant="gold"
          onClick={() =>
            void auth.signinRedirect({
              state: { returnTo: `${window.location.pathname}${window.location.search}` },
            })
          }
        >
          <LogIn className="size-4 rtl:rotate-180" /> {t('auth.signIn')}
        </Button>
      </AuthScreen>
    );
  }
  return <>{children}</>;
}
