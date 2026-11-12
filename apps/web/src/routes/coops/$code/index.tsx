import { cn, ZelligeBackdrop } from '@agricoop/ui';
import { fadeUp, spring, stagger } from '@agricoop/ui/motion';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft, MapPin, PackageSearch } from 'lucide-react';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useStorefrontCatalogue, useStorefrontGet } from '@/api/generated/storefront/storefront';
import { ok } from '@/api/ok';
import { EmptyState, ErrorAlert } from '@/components/common';
import { ProductCard, ProductCardSkeleton } from '@/components/ProductCard';
import { GROUPES, type Groupe, groupeOf } from '@/lib/home';

export const Route = createFileRoute('/coops/$code/')({
  // Optional filter (?groupe=huile|olives|soins|coffrets), also set by the home category tiles.
  validateSearch: (search: Record<string, unknown>): { groupe?: Groupe } =>
    GROUPES.includes(search.groupe as Groupe) ? { groupe: search.groupe as Groupe } : {},
  component: CataloguePage,
});

function CataloguePage() {
  const { code } = Route.useParams();
  const { groupe } = Route.useSearch();
  const { t } = useTranslation();
  const coop = ok(useStorefrontGet(code).data);
  const catalogue = useStorefrontCatalogue(code);
  const tous = useMemo(() => ok(catalogue.data) ?? [], [catalogue.data]);
  const produits = groupe ? tous.filter((p) => groupeOf(p) === groupe) : tous;

  // Chips only for the groups this cooperative actually sells.
  const groupesPresents = GROUPES.filter((g) => tous.some((p) => groupeOf(p) === g));
  // Photo variants: alternate photos between products of the same category.
  const variants = useMemo(() => {
    const seen = new Map<string, number>();
    return new Map(
      tous.map((p) => {
        const v = seen.get(p.categorie) ?? 0;
        seen.set(p.categorie, v + 1);
        return [p.produit_id, v] as const;
      }),
    );
  }, [tous]);
  const coopRef = { code, nom: coop?.nom ?? code };

  return (
    <div className="space-y-10">
      <header className="grain relative isolate overflow-hidden rounded-3xl border bg-card px-6 py-10 shadow-soft sm:px-10">
        <ZelligeBackdrop className="-z-10" />
        <div
          aria-hidden
          className="absolute -top-24 -z-10 size-80 rounded-full bg-gold/15 blur-3xl ltr:-right-20 rtl:-left-20"
        />
        <motion.div variants={stagger(0.08)} initial="hidden" animate="visible">
          <motion.div variants={fadeUp}>
            <Link
              to="/"
              hash="cooperatives"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
              {t('nav.home')}
            </Link>
          </motion.div>
          <div className="mt-5 flex items-center gap-5">
            <motion.span
              variants={fadeUp}
              aria-hidden
              className="grid size-16 shrink-0 place-items-center rounded-t-full rounded-b-xl bg-primary font-display text-3xl font-semibold text-primary-foreground shadow-lifted sm:size-20"
            >
              {(coop?.nom ?? code).replace(/^Coopérative\s+/i, '').charAt(0)}
            </motion.span>
            <div className="min-w-0">
              <motion.h1
                variants={fadeUp}
                className="font-display text-display-lg font-semibold text-balance"
              >
                {coop?.nom ?? code}
              </motion.h1>
              {coop && (
                <motion.p
                  variants={fadeUp}
                  className="mt-1 flex items-center gap-1.5 text-muted-foreground"
                >
                  <MapPin className="size-4" aria-hidden /> {coop.province}
                  <span aria-hidden className="mx-1 text-gold">
                    ✦
                  </span>
                  {t('categories.count', { count: tous.length })}
                </motion.p>
              )}
            </div>
          </div>
        </motion.div>
      </header>

      {groupesPresents.length > 1 && (
        <nav aria-label={t('catalogue.filters')}>
          <LayoutGroup id="catalogue-filters">
            <ul className="flex flex-wrap gap-2">
              {[undefined, ...groupesPresents].map((g) => {
                const active = groupe === g;
                return (
                  <li key={g ?? 'all'}>
                    <Link
                      to="/coops/$code"
                      params={{ code }}
                      search={g ? { groupe: g } : {}}
                      resetScroll={false}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'relative inline-flex h-10 items-center rounded-full border px-4 text-sm font-medium transition-colors',
                        active
                          ? 'border-transparent text-primary-foreground'
                          : 'border-border bg-card hover:border-foreground/25',
                      )}
                    >
                      {active && (
                        <motion.span
                          layoutId="filter-pill"
                          aria-hidden
                          className="absolute inset-0 rounded-full bg-primary shadow-soft"
                          transition={spring.snappy}
                        />
                      )}
                      <span className="relative">
                        {g ? t(`categories.${g}`) : t('catalogue.all')}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </LayoutGroup>
        </nav>
      )}

      <section aria-label={t('catalogue.products')}>
        {catalogue.isPending ? (
          <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 6 }, (_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : catalogue.error ? (
          <ErrorAlert error={catalogue.error} />
        ) : produits.length === 0 ? (
          <EmptyState icon={<PackageSearch className="size-7" aria-hidden />}>
            <p>{t('catalogue.empty')}</p>
          </EmptyState>
        ) : (
          <ul className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <AnimatePresence mode="popLayout" initial={false}>
              {produits.map((p) => (
                <motion.li
                  key={p.produit_id}
                  layout
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={spring.soft}
                >
                  <ProductCard
                    produit={p}
                    coop={coopRef}
                    variant={variants.get(p.produit_id) ?? 0}
                  />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </section>
    </div>
  );
}
