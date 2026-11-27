import { cn, Picture } from '@agricoop/ui';
import { fadeUp, revealViewport, stagger } from '@agricoop/ui/motion';
import { Link } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { GROUPE_PHOTO, type GroupeSummary } from '@/lib/home';
import { photo } from '@/lib/images';
import { SectionHeading } from './SectionHeading';

/**
 * Category tiles: arch-topped photos that zoom on hover while a panel slides up. A tile leads to
 * the cooperative with the most products of that kind, pre-filtered.
 */
export function Categories({ groupes }: { groupes: GroupeSummary[] }) {
  const { t } = useTranslation();
  return (
    <section
      id="categories"
      aria-labelledby="categories-title"
      className="scroll-mt-20 bg-secondary/50 py-24 sm:py-28"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          id="categories-title"
          eyebrow={t('categories.eyebrow')}
          title={t('categories.title')}
          align="center"
        />
        <motion.ul
          variants={stagger(0.08)}
          initial="hidden"
          whileInView="visible"
          viewport={revealViewport}
          className="mt-14 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4"
        >
          {groupes.map((g) => (
            <motion.li key={g.groupe} variants={fadeUp}>
              <Tile summary={g} />
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}

function Tile({ summary }: { summary: GroupeSummary }) {
  const { t } = useTranslation();
  const title = t(`categories.${summary.groupe}`);
  const body = (
    <Picture
      {...photo(GROUPE_PHOTO[summary.groupe], '(min-width: 1024px) 18rem, 45vw', 960)}
      alt=""
      className="arch aspect-[3/4] shadow-soft transition-shadow duration-500 group-hover:shadow-lifted"
      imgClassName="transition-transform duration-[900ms] ease-out-expo group-hover:scale-[1.08]"
    >
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-olive-950/90 via-olive-950/45 via-45% to-transparent to-75%"
      />
      <div className="absolute inset-x-0 bottom-0 p-4 text-white sm:p-5">
        <p className="font-display text-xl leading-tight font-semibold sm:text-2xl">{title}</p>
        <p className="mt-1 text-sm text-white/75">
          {summary.coopCode
            ? t('categories.count', { count: summary.count })
            : t('categories.soon')}
        </p>
        {summary.coopCode && (
          <span className="mt-3 inline-flex translate-y-2 items-center gap-1.5 text-sm font-semibold text-gold-200 opacity-0 transition-all duration-300 ease-out-expo group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100 max-lg:translate-y-0 max-lg:opacity-100">
            {t('categories.explore')}
            <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
          </span>
        )}
      </div>
    </Picture>
  );

  return summary.coopCode ? (
    <Link
      to="/coops/$code"
      params={{ code: summary.coopCode }}
      search={{ groupe: summary.groupe }}
      aria-label={`${title} — ${t('categories.count', { count: summary.count })}`}
      className="group block rounded-t-full rounded-b-xl"
    >
      {body}
    </Link>
  ) : (
    <div className={cn('group opacity-80')} aria-label={`${title} — ${t('categories.soon')}`}>
      {body}
    </div>
  );
}
