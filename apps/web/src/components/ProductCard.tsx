import type { ProduitCatalogue } from '@agricoop/shared';
import { Badge, Button, cn, Picture, Skeleton } from '@agricoop/ui';
import { Link } from '@tanstack/react-router';
import { Plus, ScanLine } from 'lucide-react';
import { motion } from 'motion/react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useCart } from '@/cart/cart';
import { useAddToCart } from '@/cart/useAddToCart';
import { Price } from '@/components/Price';
import { photo, photoUrl, productPhoto } from '@/lib/images';
import { supportsViewTransitions } from '@/lib/ui';

/** Shared-element name: the card image morphs into the product page gallery. */
export const productImageTransition = (produitId: string) => `produit-${produitId}`;

/**
 * Catalogue card: image (second photo on hover), quick "Ajouter" sliding up (always visible on
 * touch screens), price, availability. The heading's stretched link opens the product page.
 */
export function ProductCard({
  produit,
  coop,
  variant,
}: {
  produit: ProduitCatalogue;
  coop: { code: string; nom: string };
  variant: number;
}) {
  const { t } = useTranslation();
  const cart = useCart();
  const add = useAddToCart();
  const imageRef = useRef<HTMLDivElement>(null);
  const inCart = cart.cart.lines.find((l) => l.produit_id === produit.produit_id)?.quantite ?? 0;
  const remaining = Math.max(0, produit.disponible - inCart);
  const main = productPhoto(produit.categorie, produit.famille, variant);
  const alt = productPhoto(produit.categorie, produit.famille, variant + 1);
  const transitionName = productImageTransition(produit.produit_id);

  return (
    <article className="group relative flex h-full flex-col">
      {/* Plain wrapper: the image box gets its own stacking context (view-transition-name), so the
          quick-add button must live outside it to stay above the card's stretched link. */}
      <div className="relative">
        <motion.div
          ref={imageRef}
          // Motion shared layout as the fallback when the browser has no View Transitions.
          layoutId={supportsViewTransitions ? undefined : transitionName}
          style={supportsViewTransitions ? { viewTransitionName: transitionName } : undefined}
          className="relative overflow-hidden rounded-2xl"
        >
          <Picture
            {...photo(main, '(min-width: 1024px) 22rem, (min-width: 640px) 45vw, 92vw', 960)}
            alt=""
            className="aspect-[4/5] shadow-soft transition-shadow duration-500 group-hover:shadow-lifted"
            imgClassName="transition-[transform,opacity] duration-700 ease-out-expo group-hover:scale-[1.05]"
          >
            {alt !== main && (
              <Picture
                {...photo(alt, '(min-width: 1024px) 22rem, 45vw', 960)}
                alt=""
                className="absolute inset-0 bg-transparent opacity-0 transition-opacity duration-700 ease-out-expo group-hover:opacity-100 max-md:hidden"
              />
            )}
            <div className="absolute start-3 top-3 flex flex-wrap gap-1.5">
              <Badge className="border-white/30 bg-white/85 text-olive-900 backdrop-blur dark:bg-black/55 dark:text-olive-100">
                {t(`famille.${produit.famille}`)}
              </Badge>
              {produit.niveau_qr === 'unite' && (
                <Badge
                  variant="gold"
                  className="bg-white/85 backdrop-blur dark:bg-black/55"
                  title={t('catalogue.qrUnit')}
                >
                  <ScanLine aria-hidden /> QR
                </Badge>
              )}
            </div>
            {produit.disponible === 0 && (
              <div className="absolute inset-0 grid place-items-center bg-background/55 backdrop-blur-[2px]">
                <span className="rounded-full bg-card px-4 py-1.5 text-sm font-semibold shadow-soft">
                  {t('catalogue.soldOut')}
                </span>
              </div>
            )}
          </Picture>
        </motion.div>
        {/* Quick add: slides up on hover/focus (desktop), always shown on touch screens. */}
        <div className="absolute inset-x-3 bottom-3 z-10 translate-y-3 opacity-0 transition-all duration-300 ease-out-expo group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:translate-y-0 group-hover:opacity-100 max-md:translate-y-0 max-md:opacity-100">
          <Button
            variant="gold"
            shape="pill"
            className="w-full shadow-lifted"
            disabled={remaining === 0}
            onClick={() =>
              add(produit, coop, 1, { element: imageRef.current, image: photoUrl(main, 160) })
            }
          >
            <Plus className="size-4" /> {t('catalogue.add')}
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-1 items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-lg leading-snug font-semibold">
            <Link
              to="/coops/$code/produits/$produitId"
              params={{ code: coop.code, produitId: produit.produit_id }}
              className={cn(
                // Stretched over the image too, below the quick-add button (z-10).
                "after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:outline-none",
                'focus-visible:after:outline-2 focus-visible:after:outline-offset-4 focus-visible:after:outline-ring',
              )}
            >
              {produit.nom}
            </Link>
          </h2>
          <p
            className={cn(
              'mt-1 text-sm',
              produit.disponible === 0 ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            {produit.disponible === 0
              ? t('catalogue.soldOut')
              : t('catalogue.available', { count: produit.disponible })}
          </p>
        </div>
        <Price value={produit.prix_mad} className="shrink-0 pt-0.5 font-semibold" />
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div>
      <Skeleton className="aspect-[4/5] rounded-2xl" />
      <Skeleton className="mt-4 h-5 w-3/4" />
      <Skeleton className="mt-2 h-4 w-1/3" />
    </div>
  );
}
