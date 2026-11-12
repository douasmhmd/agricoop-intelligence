import { Badge, Button, cn, Picture, Skeleton, useDirection } from '@agricoop/ui';
import { Link } from '@tanstack/react-router';
import useEmblaCarousel from 'embla-carousel-react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { Money } from '@/components/common';
import type { ProduitVitrine } from '@/lib/home';
import { photo, productPhoto } from '@/lib/images';
import { SectionHeading } from './SectionHeading';

/** Featured products carousel (Embla: drag/swipe, keyboard-reachable controls, RTL-aware). */
export function Featured({ produits, pending }: { produits: ProduitVitrine[]; pending: boolean }) {
  const { t } = useTranslation();
  const dir = useDirection();
  const [viewportRef, embla] = useEmblaCarousel({
    align: 'start',
    direction: dir,
    containScroll: 'trimSnaps',
    dragFree: false,
  });
  // Button states follow Embla's own events (no effect-driven state).
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!embla) return () => undefined;
      embla.on('select', onChange).on('reInit', onChange);
      return () => {
        embla.off('select', onChange).off('reInit', onChange);
      };
    },
    [embla],
  );
  const canPrev = useSyncExternalStore(
    subscribe,
    () => embla?.canScrollPrev() ?? false,
    () => false,
  );
  const canNext = useSyncExternalStore(
    subscribe,
    () => embla?.canScrollNext() ?? false,
    () => false,
  );

  // Re-measure when the direction or the slide count changes.
  useEffect(() => {
    embla?.reInit({ direction: dir });
  }, [embla, dir, produits.length]);

  return (
    <section id="produits" aria-labelledby="produits-title" className="scroll-mt-20 py-24 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          id="produits-title"
          eyebrow={t('featured.eyebrow')}
          title={t('featured.title')}
          lead={t('featured.subtitle')}
        >
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon-lg"
              shape="pill"
              aria-label={t('featured.prev')}
              disabled={!canPrev}
              onClick={() => embla?.scrollPrev()}
            >
              <ArrowLeft className="rtl:rotate-180" />
            </Button>
            <Button
              variant="outline"
              size="icon-lg"
              shape="pill"
              aria-label={t('featured.next')}
              disabled={!canNext}
              onClick={() => embla?.scrollNext()}
            >
              <ArrowRight className="rtl:rotate-180" />
            </Button>
          </div>
        </SectionHeading>
      </div>

      <div className="mx-auto mt-12 max-w-7xl ps-4 sm:ps-6 lg:px-8">
        <div ref={viewportRef} className="overflow-hidden" dir={dir}>
          <ul className="-ms-5 flex touch-pan-y">
            {pending && produits.length === 0
              ? Array.from({ length: 4 }, (_, i) => (
                  <li key={i} className={slideClass}>
                    <Skeleton className="aspect-[4/5] rounded-xl" />
                    <Skeleton className="mt-4 h-5 w-3/4" />
                    <Skeleton className="mt-2 h-4 w-1/2" />
                  </li>
                ))
              : withVariants(produits).map(({ produit, variant }) => (
                  <li key={produit.produit_id} className={slideClass}>
                    <ProductTeaser produit={produit} variant={variant} />
                  </li>
                ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/** Rank of each product among those of the same category, so neighbours get different photos. */
function withVariants(produits: ProduitVitrine[]) {
  const seen = new Map<string, number>();
  return produits.map((produit) => {
    const variant = seen.get(produit.categorie) ?? 0;
    seen.set(produit.categorie, variant + 1);
    return { produit, variant };
  });
}

const slideClass =
  'min-w-0 shrink-0 grow-0 basis-[78%] ps-5 sm:basis-[46%] lg:basis-1/3 xl:basis-1/4';

/**
 * Product card. The stretched link covers the card, but its accessible name is the product name
 * only (the cooperative's name sits outside the link).
 */
function ProductTeaser({ produit, variant }: { produit: ProduitVitrine; variant: number }) {
  const { t } = useTranslation();
  return (
    <article className="group relative">
      <Picture
        {...photo(
          productPhoto(produit.categorie, produit.famille, variant),
          '(min-width: 1280px) 20rem, (min-width: 640px) 45vw, 78vw',
          960,
        )}
        alt=""
        className="aspect-[4/5] rounded-xl shadow-soft transition-shadow duration-500 group-hover:shadow-lifted"
        imgClassName="transition-transform duration-700 ease-out-expo group-hover:scale-[1.06]"
      >
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/0 to-black/0 opacity-70 transition-opacity duration-500 group-hover:opacity-100"
        />
        <Badge className="absolute start-3 top-3 border-white/30 bg-white/80 text-olive-900 backdrop-blur dark:bg-black/50 dark:text-olive-100">
          {t(`famille.${produit.famille}`)}
        </Badge>
        <span
          aria-hidden
          className="absolute end-3 bottom-3 grid size-11 translate-y-3 place-items-center rounded-full bg-gold text-gold-foreground opacity-0 shadow-lifted transition-all duration-300 ease-out-expo group-hover:translate-y-0 group-hover:opacity-100"
        >
          <ArrowRight className="size-5 rtl:rotate-180" />
        </span>
      </Picture>
      <div className="mt-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-lg leading-snug font-semibold">
            <Link
              to="/coops/$code"
              params={{ code: produit.coop.code }}
              className={cn(
                'rounded-sm after:absolute after:inset-0 after:content-[""] focus-visible:outline-none',
                'after:rounded-xl focus-visible:after:outline-2 focus-visible:after:outline-offset-4 focus-visible:after:outline-ring',
              )}
            >
              {produit.nom}
            </Link>
          </h3>
          <p className="mt-1 truncate text-sm text-muted-foreground">{produit.coop.nom}</p>
        </div>
        <Money value={produit.prix_mad} className="shrink-0 font-semibold" />
      </div>
    </article>
  );
}
