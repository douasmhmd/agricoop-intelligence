import { Button } from '@agricoop/ui';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ShoppingBag } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCart } from '@/cart/cart';
import { CartLines } from '@/cart/CartDrawer';
import { CheckoutSteps } from '@/components/CheckoutSteps';
import { EmptyState } from '@/components/common';
import { Price } from '@/components/Price';

export const Route = createFileRoute('/panier')({
  component: CartPage,
});

/** Full-page cart (direct visits, links opened in a new tab); the drawer covers the usual path. */
function CartPage() {
  const { t } = useTranslation();
  const { cart, setQuantity, total } = useCart();
  const empty = cart.lines.length === 0 || !cart.coopCode;

  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <CheckoutSteps current={0} />
      <div>
        <h1 className="font-display text-display-lg font-semibold">{t('cart.title')}</h1>
        {!empty && (
          <p className="mt-2 text-muted-foreground">
            {t('cart.from', { coop: cart.coopNom ?? cart.coopCode })}
          </p>
        )}
      </div>
      {empty || !cart.coopCode ? (
        <EmptyState icon={<ShoppingBag className="size-7" aria-hidden />}>
          <p>{t('cart.empty')}</p>
          <Link to="/" hash="produits" className="text-primary underline">
            {t('cart.browse')}
          </Link>
        </EmptyState>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
          <CartLines lines={cart.lines} onQuantity={setQuantity} />
          <aside className="h-fit space-y-4 rounded-2xl border bg-card p-6 shadow-soft lg:sticky lg:top-28">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">{t('cart.total')}</span>
              <Price value={total} className="font-display text-2xl font-semibold" />
            </div>
            <p className="text-xs text-muted-foreground">{t('cart.priceNotice')}</p>
            <Button asChild size="xl" shape="pill" variant="gold" className="w-full">
              <Link to="/coops/$code/commander" params={{ code: cart.coopCode }}>
                {t('cart.checkout')}
              </Link>
            </Button>
          </aside>
        </div>
      )}
    </div>
  );
}
