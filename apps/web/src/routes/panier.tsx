import { lineTotal } from '@agricoop/shared';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCart } from '@/cart/cart';
import { EmptyState, Money, QuantityStepper } from '@/components/common';
import { Button } from '@agricoop/ui';

export const Route = createFileRoute('/panier')({
  component: CartPage,
});

function CartPage() {
  const { t } = useTranslation();
  const { cart, setQuantity, total } = useCart();

  if (cart.lines.length === 0 || !cart.coopCode) {
    return (
      <>
        <h1 className="mb-4 text-2xl font-bold">{t('cart.title')}</h1>
        <EmptyState>
          <p>{t('cart.empty')}</p>
          <Link to="/" className="text-primary underline">
            {t('cart.browse')}
          </Link>
        </EmptyState>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-bold">{t('cart.title')}</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        {t('cart.from', { coop: cart.coopNom ?? cart.coopCode })}
      </p>
      <ul className="grid gap-3">
        {cart.lines.map((l) => (
          <li
            key={l.produit_id}
            className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium">{l.nom}</p>
              <p className="text-sm text-muted-foreground">
                <Money value={l.prix_mad} /> × {l.quantite}
              </p>
            </div>
            <QuantityStepper
              value={l.quantite}
              max={l.disponible}
              onChange={(q) => setQuantity(l.produit_id, q)}
              label={t('cart.quantity')}
            />
            <Money
              value={lineTotal(l.prix_mad, l.quantite)}
              className="w-24 text-end font-medium"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setQuantity(l.produit_id, 0)}
              aria-label={t('cart.remove')}
            >
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
      </ul>
      <div className="sticky bottom-0 mt-5 flex items-center justify-between gap-3 border-t bg-background py-4">
        <div>
          <p className="text-sm text-muted-foreground">{t('cart.total')}</p>
          <Money value={total} className="text-xl font-semibold" />
        </div>
        <Button asChild size="lg">
          <Link to="/coops/$code/commander" params={{ code: cart.coopCode }}>
            {t('cart.checkout')}
          </Link>
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t('cart.priceNotice')}</p>
    </>
  );
}
