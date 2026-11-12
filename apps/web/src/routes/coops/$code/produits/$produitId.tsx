import type { ProduitCatalogue } from '@agricoop/shared';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Badge,
  Button,
  cn,
  Ornament,
  Picture,
  Skeleton,
  useDirection,
} from '@agricoop/ui';
import { fadeUp, stagger } from '@agricoop/ui/motion';
import { createFileRoute, Link } from '@tanstack/react-router';
import useEmblaCarousel from 'embla-carousel-react';
import { ArrowLeft, Lock, PackageSearch, ScanLine, ShoppingBag, Sprout } from 'lucide-react';
import { motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { useStorefrontCatalogue, useStorefrontGet } from '@/api/generated/storefront/storefront';
import { ok } from '@/api/ok';
import { useCart } from '@/cart/cart';
import { useAddToCart } from '@/cart/useAddToCart';
import { EmptyState, ErrorAlert, QuantityStepper } from '@/components/common';
import { Price } from '@/components/Price';
import { ProductCard, productImageTransition } from '@/components/ProductCard';
import { groupeOf } from '@/lib/home';
import { photo, photoUrl, type PhotoKey, productPhoto } from '@/lib/images';
import { supportsViewTransitions } from '@/lib/ui';

/*
 * Product page. The public API has no single-product endpoint, so the page reads the coop's
 * catalogue (already cached when coming from the catalogue) and picks the product.
 */
export const Route = createFileRoute('/coops/$code/produits/$produitId')({
  component: ProductPage,
});

function ProductPage() {
  const { code, produitId } = Route.useParams();
  const { t } = useTranslation();
  const coop = ok(useStorefrontGet(code).data);
  const catalogue = useStorefrontCatalogue(code);
  const tous = ok(catalogue.data) ?? [];
  const produit = tous.find((p) => p.produit_id === produitId);

  if (catalogue.isPending) return <ProductSkeleton />;
  if (catalogue.error) return <ErrorAlert error={catalogue.error} />;
  if (!produit) {
    return (
      <EmptyState icon={<PackageSearch className="size-7" aria-hidden />}>
        <p>{t('product.notFound')}</p>
        <Link to="/coops/$code" params={{ code }} className="text-primary underline">
          {t('product.back')}
        </Link>
      </EmptyState>
    );
  }

  const coopRef = { code, nom: coop?.nom ?? code };
  const candidates: PhotoKey[] = [
    productPhoto(produit.categorie, produit.famille, 0),
    productPhoto(produit.categorie, produit.famille, 1),
    'leaves',
    'grove',
  ];
  const photos = candidates.filter((p, i) => candidates.indexOf(p) === i);
  const autres = tous.filter((p) => p.produit_id !== produit.produit_id).slice(0, 3);

  return (
    <div className="space-y-20">
      <div>
        <Link
          to="/coops/$code"
          params={{ code }}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
          {coop?.nom ?? t('product.back')}
        </Link>
        <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14">
          <Gallery photos={photos} transitionName={productImageTransition(produit.produit_id)} />
          <BuyBox produit={produit} coop={coopRef} province={coop?.province} image={photos[0]!} />
        </div>
      </div>

      {autres.length > 0 && (
        <section aria-labelledby="same-coop">
          <Ornament className="mb-10" />
          <h2 id="same-coop" className="font-display text-display-md font-semibold">
            {t('product.sameCoop')}
          </h2>
          <ul className="mt-8 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {autres.map((p, i) => (
              <li key={p.produit_id}>
                <ProductCard produit={p} coop={coopRef} variant={i + 1} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** Embla gallery with thumbnails; the first photo is the shared element from the catalogue card. */
function Gallery({ photos, transitionName }: { photos: PhotoKey[]; transitionName: string }) {
  const { t } = useTranslation();
  const dir = useDirection();
  const [viewportRef, embla] = useEmblaCarousel({ direction: dir, loop: false });
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
  const selected = useSyncExternalStore(
    subscribe,
    () => embla?.selectedScrollSnap() ?? 0,
    () => 0,
  );
  useEffect(() => {
    embla?.reInit({ direction: dir });
  }, [embla, dir]);

  return (
    <div className="lg:sticky lg:top-28 lg:self-start">
      <motion.div
        layoutId={supportsViewTransitions ? undefined : transitionName}
        style={supportsViewTransitions ? { viewTransitionName: transitionName } : undefined}
        className="overflow-hidden rounded-3xl shadow-lifted"
      >
        <div ref={viewportRef} className="overflow-hidden" dir={dir}>
          <div className="flex touch-pan-y">
            {photos.map((key, i) => (
              <div
                key={key}
                className="min-w-0 shrink-0 grow-0 basis-full"
                role="group"
                aria-roledescription="slide"
                aria-label={t('product.photo', { n: i + 1 })}
              >
                <Picture
                  {...photo(key, '(min-width: 1024px) 40rem, 100vw', 1600)}
                  alt=""
                  priority={i === 0}
                  className="aspect-[4/5] sm:aspect-[5/4] lg:aspect-[4/5]"
                />
              </div>
            ))}
          </div>
        </div>
      </motion.div>
      <div role="group" aria-label={t('product.gallery')} className="mt-4 flex gap-3">
        {photos.map((key, i) => (
          <button
            key={key}
            type="button"
            onClick={() => embla?.scrollTo(i)}
            aria-label={t('product.photo', { n: i + 1 })}
            aria-current={selected === i ? 'true' : undefined}
            className={cn(
              'relative size-16 cursor-pointer overflow-hidden rounded-xl ring-offset-2 ring-offset-background transition-all duration-300 sm:size-20',
              selected === i ? 'ring-2 ring-gold' : 'opacity-70 hover:opacity-100',
            )}
          >
            <Picture {...photo(key, '80px', 400)} alt="" className="size-full" />
          </button>
        ))}
      </div>
    </div>
  );
}

function BuyBox({
  produit,
  coop,
  province,
  image,
}: {
  produit: ProduitCatalogue;
  coop: { code: string; nom: string };
  province: string | undefined;
  image: PhotoKey;
}) {
  const { t } = useTranslation();
  const cart = useCart();
  const add = useAddToCart();
  const [quantite, setQuantite] = useState(1);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inCart = cart.cart.lines.find((l) => l.produit_id === produit.produit_id)?.quantite ?? 0;
  const remaining = Math.max(0, produit.disponible - inCart);
  const groupe = groupeOf(produit) ?? 'autre';

  return (
    <motion.div variants={stagger(0.07)} initial="hidden" animate="visible" className="lg:pt-2">
      <motion.div variants={fadeUp} className="flex flex-wrap gap-2">
        <Badge>{t(`famille.${produit.famille}`)}</Badge>
        {produit.niveau_qr === 'unite' && (
          <Badge variant="gold">
            <ScanLine aria-hidden /> QR
          </Badge>
        )}
      </motion.div>
      <motion.h1
        variants={fadeUp}
        className="mt-4 font-display text-display-lg font-semibold text-balance"
      >
        {produit.nom}
      </motion.h1>
      <motion.p variants={fadeUp} className="mt-2 text-muted-foreground">
        <Link
          to="/coops/$code"
          params={{ code: coop.code }}
          className="hover:text-foreground hover:underline"
        >
          {coop.nom}
        </Link>
        {province && ` · ${province}`}
      </motion.p>

      <motion.div variants={fadeUp} className="mt-8 flex items-end justify-between gap-4">
        <Price value={produit.prix_mad} className="font-display text-display-md font-semibold" />
        <p
          className={cn(
            'flex items-center gap-2 text-sm font-medium',
            produit.disponible === 0 ? 'text-destructive' : 'text-success',
          )}
        >
          <span aria-hidden className="size-2 rounded-full bg-current" />
          {produit.disponible === 0
            ? t('catalogue.soldOut')
            : t('catalogue.available', { count: produit.disponible })}
        </p>
      </motion.div>

      <motion.div variants={fadeUp} className="mt-6 flex flex-wrap items-center gap-3">
        <QuantityStepper
          value={quantite}
          max={Math.max(1, remaining)}
          onChange={setQuantite}
          label={t('cart.quantity')}
        />
        <Button
          ref={buttonRef}
          size="xl"
          shape="pill"
          variant="gold"
          className="min-w-0 flex-1"
          disabled={remaining === 0}
          onClick={() => {
            if (
              add(produit, coop, quantite, {
                element: buttonRef.current,
                image: photoUrl(image, 160),
              })
            ) {
              setQuantite(1);
            }
          }}
        >
          <ShoppingBag className="size-5" /> {t('product.addToCart')}
        </Button>
      </motion.div>

      <motion.ul variants={fadeUp} className="mt-6 grid gap-2 text-sm text-muted-foreground">
        <li className="flex items-center gap-2">
          <Lock className="size-4 text-primary" aria-hidden /> {t('product.securePayment')}
        </li>
        <li className="flex items-center gap-2">
          <ScanLine className="size-4 text-primary" aria-hidden />
          {produit.niveau_qr === 'unite' ? t('catalogue.qrUnit') : t('product.qrLot')}
        </li>
        <li className="flex items-center gap-2">
          <Sprout className="size-4 text-primary" aria-hidden /> {t('hero.direct')}
        </li>
      </motion.ul>

      <motion.div variants={fadeUp} className="mt-8 rounded-2xl border bg-card px-5 shadow-soft">
        <Accordion type="single" collapsible defaultValue="description">
          <AccordionItem value="description">
            <AccordionTrigger>{t('product.description')}</AccordionTrigger>
            <AccordionContent>{t(`product.desc.${groupe}`)}</AccordionContent>
          </AccordionItem>
          <AccordionItem value="origin">
            <AccordionTrigger>{t('product.origin')}</AccordionTrigger>
            <AccordionContent>
              {t('product.originText', { coop: coop.nom, province: province ?? '—' })}
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="trace">
            <AccordionTrigger>{t('product.traceability')}</AccordionTrigger>
            <AccordionContent>
              {produit.niveau_qr === 'unite' ? t('product.traceUnit') : t('product.traceLot')}
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="reference">
            <AccordionTrigger>{t('product.reference')}</AccordionTrigger>
            <AccordionContent>
              <span className="font-mono text-foreground" dir="ltr">
                {produit.code}
              </span>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </motion.div>
    </motion.div>
  );
}

function ProductSkeleton() {
  return (
    <div className="grid gap-10 pt-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14">
      <Skeleton className="aspect-[4/5] rounded-3xl" />
      <div className="space-y-4">
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-12 w-4/5" />
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="mt-8 h-10 w-40" />
        <Skeleton className="h-13 w-full rounded-full" />
      </div>
    </div>
  );
}
