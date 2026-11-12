import { LogIn } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from 'react-oidc-context';
import { Loading } from '@/components/common';
import { Button, ZelligeBackdrop } from '@agricoop/ui';

/** Customer pages (checkout, account, orders): sign in first, then come back to the same page. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const { t } = useTranslation();
  if (auth.isLoading || auth.activeNavigator) return <Loading />;
  if (!auth.isAuthenticated) {
    return (
      <div className="relative isolate mx-auto grid max-w-md gap-5 overflow-hidden rounded-3xl border bg-card px-6 py-12 text-center shadow-soft">
        <ZelligeBackdrop className="-z-10" />
        <span className="mx-auto grid size-14 place-items-center rounded-t-full rounded-b-xl bg-primary text-primary-foreground">
          <LogIn className="size-6 rtl:rotate-180" aria-hidden />
        </span>
        <p className="font-display text-xl font-semibold">{t('auth.required')}</p>
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
        <p className="text-sm text-muted-foreground">{t('auth.registerHint')}</p>
      </div>
    );
  }
  return <>{children}</>;
}
