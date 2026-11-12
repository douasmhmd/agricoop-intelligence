import { LogIn } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from 'react-oidc-context';
import { Loading } from '@/components/common';
import { Button } from '@agricoop/ui';

/** Customer pages (checkout, account, orders): sign in first, then come back to the same page. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const { t } = useTranslation();
  if (auth.isLoading || auth.activeNavigator) return <Loading />;
  if (!auth.isAuthenticated) {
    return (
      <div className="mx-auto grid max-w-sm gap-4 py-10 text-center">
        <p>{t('auth.required')}</p>
        <Button
          size="lg"
          onClick={() =>
            void auth.signinRedirect({
              state: { returnTo: `${window.location.pathname}${window.location.search}` },
            })
          }
        >
          <LogIn className="size-4 rtl:rotate-180" /> {t('auth.signIn')}
        </Button>
        <p className="text-sm text-muted-foreground">{t('auth.registerHint')}</p>
      </div>
    );
  }
  return <>{children}</>;
}
