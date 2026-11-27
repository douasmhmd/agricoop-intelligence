import { Badge, Card, Skeleton, ZelligeBackdrop } from '@agricoop/ui';
import { fadeUp, revealViewport, stagger } from '@agricoop/ui/motion';
import { Link } from '@tanstack/react-router';
import { ArrowRight, MapPin } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { EmptyState, ErrorAlert, useLocale } from '@/components/common';
import { formatMad } from '@agricoop/shared';
import type { CoopSummary } from '@/lib/home';
import { SectionHeading } from './SectionHeading';

/** The cooperatives, with figures taken from their live catalogues (no invented reviews). */
export function CoopHighlights({
  summaries,
  pending,
  error,
}: {
  summaries: CoopSummary[];
  pending: boolean;
  error: unknown;
}) {
  const { t } = useTranslation();
  return (
    <section
      id="cooperatives"
      aria-labelledby="cooperatives-title"
      className="scroll-mt-20 py-24 sm:py-28"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          id="cooperatives-title"
          eyebrow={t('coops.eyebrow')}
          title={t('home.cooperatives')}
          lead={t('coops.subtitle')}
        />
        <div className="mt-12">
          {pending ? (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-52 rounded-xl" />
              ))}
            </div>
          ) : error ? (
            <ErrorAlert error={error} />
          ) : summaries.length === 0 ? (
            <EmptyState>{t('home.none')}</EmptyState>
          ) : (
            <motion.ul
              variants={stagger(0.08)}
              initial="hidden"
              whileInView="visible"
              viewport={revealViewport}
              className="grid gap-5 md:grid-cols-2 lg:grid-cols-3"
            >
              {summaries.map((s) => (
                <motion.li key={s.coop.code} variants={fadeUp}>
                  <CoopCard summary={s} />
                </motion.li>
              ))}
            </motion.ul>
          )}
        </div>
      </div>
    </section>
  );
}

function CoopCard({ summary }: { summary: CoopSummary }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { coop } = summary;
  return (
    <Card interactive className="group relative h-full gap-5 overflow-hidden p-6">
      <ZelligeBackdrop
        fade="radial"
        className="opacity-60 transition-opacity duration-500 group-hover:opacity-100"
      />
      <div className="relative flex items-start gap-4">
        <span
          aria-hidden
          className="grid size-14 shrink-0 place-items-center rounded-t-full rounded-b-lg bg-primary font-display text-2xl font-semibold text-primary-foreground shadow-soft"
        >
          {coop.nom.replace(/^Coopérative\s+/i, '').charAt(0)}
        </span>
        <div className="min-w-0">
          <h3 className="font-display text-xl leading-snug font-semibold">
            {/* Stretched link: the whole card is clickable; its name is the cooperative's. */}
            <Link
              to="/coops/$code"
              params={{ code: coop.code }}
              className="after:absolute after:inset-0 after:rounded-lg after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ring"
            >
              {coop.nom}
            </Link>
          </h3>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="size-3.5" aria-hidden /> {coop.province}
          </p>
        </div>
      </div>
      <div className="relative flex flex-wrap gap-1.5">
        {summary.familles.map((f) => (
          <Badge
            key={f}
            variant={f === 'coffret' ? 'gold' : f === 'cosmetique' ? 'terracotta' : 'default'}
          >
            {t(`famille.${f}`)}
          </Badge>
        ))}
      </div>
      <div className="relative mt-auto flex items-end justify-between gap-3 border-t pt-4 text-sm">
        <div>
          <p className="font-medium">{t('categories.count', { count: summary.produits })}</p>
          {summary.prixMin && (
            <p className="text-muted-foreground">
              {t('coops.from', { price: formatMad(summary.prixMin, locale) })}
            </p>
          )}
        </div>
        <span className="inline-flex items-center gap-1 font-semibold text-primary">
          {t('coops.visit')}
          <ArrowRight
            className="size-4 transition-transform duration-300 ease-out-expo group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1"
            aria-hidden
          />
        </span>
      </div>
    </Card>
  );
}
