import { Link } from '@tanstack/react-router';
import { ShoppingBag, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from 'react-oidc-context';
import { useCart } from '@/cart/cart';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Button } from '@/components/ui/button';

export function SiteHeader() {
  const { t } = useTranslation();
  const auth = useAuth();
  const { count } = useCart();
  return (
    <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-2">
        <Link to="/" className="me-auto text-lg font-semibold text-primary">
          {t('app.name')}
        </Link>
        <LanguageSwitcher />
        {auth.isAuthenticated ? (
          <Button asChild variant="ghost" size="icon" aria-label={t('nav.account')}>
            <Link to="/compte">
              <UserRound className="size-5" />
            </Link>
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              void auth.signinRedirect({
                state: { returnTo: `${window.location.pathname}${window.location.search}` },
              })
            }
          >
            {t('auth.signIn')}
          </Button>
        )}
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={t('nav.cart', { count })}
        >
          <Link to="/panier">
            <ShoppingBag className="size-5" />
            {count > 0 && (
              <span className="absolute -top-0.5 -end-0.5 grid min-w-5 place-items-center rounded-full bg-primary px-1 text-xs text-primary-foreground tabular-nums">
                {count}
              </span>
            )}
          </Link>
        </Button>
      </div>
    </header>
  );
}
