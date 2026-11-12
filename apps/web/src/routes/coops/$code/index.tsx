import type { ProduitCatalogue } from '@agricoop/shared';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { ShoppingBag, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useStorefrontCatalogue, useStorefrontGet } from '@/api/generated/storefront/storefront';
import { ok } from '@/api/ok';
import { useCart } from '@/cart/cart';
import { EmptyState, ErrorAlert, Loading, Money, QuantityStepper } from '@/components/common';
import { Badge, Button } from '@agricoop/ui';
import { GROUPES, type Groupe, groupeOf } from '@/lib/home';

export const Route = createFileRoute('/coops/$code/')({
  // Optional filter set by the home page's category tiles (?groupe=huile|olives|soins|coffrets).
  validateSearch: (search: Record<string, unknown>): { groupe?: Groupe } =>
    GROUPES.includes(search.groupe as Groupe) ? { groupe: search.groupe as Groupe } : {},
  component: CataloguePage,
});

function CataloguePage() {
  const { code } = Route.useParams();
  const { t } = useTranslation();
  const coop = ok(useStorefrontGet(code).data);
  const catalogue = useStorefrontCatalogue(code);
  const { groupe } = Route.useSearch();
  const tous = ok(catalogue.data) ?? [];
  const produits = groupe ? tous.filter((p) => groupeOf(p) === groupe) : tous;

  return (
    <>
      <div className="mb-5">
        <Link to="/" className="text-sm text-muted-foreground hover:underline">
          {t('nav.home')}
        </Link>
        <h1 className="mt-1 text-2xl font-bold">{coop?.nom ?? code}</h1>
        {coop && <p className="text-sm text-muted-foreground">{coop.province}</p>}
        {groupe && (
          <Link
            to="/coops/$code"
            params={{ code }}
            search={{}}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-sm shadow-soft hover:bg-accent"
            aria-label={t('catalogue.clearFilter')}
          >
            {t('catalogue.filtered', { famille: t(`categories.${groupe}`) })}
            <X className="size-3.5" aria-hidden />
          </Link>
        )}
      </div>
      {catalogue.isPending ? (
        <Loading />
      ) : catalogue.error ? (
        <ErrorAlert error={catalogue.error} />
      ) : produits.length === 0 ? (
        <EmptyState>{t('catalogue.empty')}</EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {produits.map((p) => (
            <ProductCard key={p.produit_id} produit={p} coop={{ code, nom: coop?.nom ?? code }} />
          ))}
        </ul>
      )}
    </>
  );
}

function ProductCard({
  produit,
  coop,
}: {
  produit: ProduitCatalogue;
  coop: { code: string; nom: string };
}) {
  const { t } = useTranslation();
  const cart = useCart();
  const navigate = useNavigate();
  const [quantite, setQuantite] = useState(1);
  const inCart = cart.cart.lines.find((l) => l.produit_id === produit.produit_id)?.quantite ?? 0;
  const remaining = Math.max(0, produit.disponible - inCart);

  const add = () => {
    const item = {
      produit_id: produit.produit_id,
      code: produit.code,
      nom: produit.nom,
      prix_mad: produit.prix_mad,
      disponible: produit.disponible,
    };
    if (cart.add(coop, item, quantite) === 'other_coop') {
      // One order = one cooperative: offer to start a new cart.
      if (!window.confirm(t('cart.otherCoop', { coop: cart.cart.coopNom ?? '' }))) return;
      cart.add(coop, item, quantite, { replace: true });
    }
    setQuantite(1);
    toast.success(t('cart.added', { nom: produit.nom }), {
      action: { label: t('cart.view'), onClick: () => void navigate({ to: '/panier' }) },
    });
  };

  return (
    <li className="flex flex-col rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-medium leading-snug">{produit.nom}</h2>
        <Badge variant="secondary">{t(`famille.${produit.famille}`)}</Badge>
      </div>
      <Money value={produit.prix_mad} className="mt-2 text-xl font-semibold" />
      <p
        className={`mt-1 text-sm ${produit.disponible === 0 ? 'text-red-700' : 'text-muted-foreground'}`}
      >
        {produit.disponible === 0
          ? t('catalogue.soldOut')
          : t('catalogue.available', { count: produit.disponible })}
      </p>
      {produit.niveau_qr === 'unite' && (
        <p className="mt-1 text-xs text-muted-foreground">{t('catalogue.qrUnit')}</p>
      )}
      <div className="mt-auto flex items-center gap-2 pt-4">
        <QuantityStepper
          value={quantite}
          max={Math.max(1, remaining)}
          onChange={setQuantite}
          label={t('cart.quantity')}
        />
        <Button className="h-10 flex-1" onClick={add} disabled={remaining === 0}>
          <ShoppingBag className="size-4" /> {t('catalogue.add')}
        </Button>
      </div>
    </li>
  );
}
