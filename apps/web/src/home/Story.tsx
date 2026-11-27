import { Ornament, Picture } from '@agricoop/ui';
import { fadeUp, revealViewport, slideInFromStart, stagger } from '@agricoop/ui/motion';
import { useDirection } from '@agricoop/ui';
import NumberFlow from '@number-flow/react';
import { motion, useInView } from 'motion/react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { photo } from '@/lib/images';

/** "Notre histoire": harvest photo in an arch, the story, and live platform figures. */
export function Story({
  coops,
  produits,
  provinces,
}: {
  coops: number;
  produits: number;
  provinces: number;
}) {
  const { t, i18n } = useTranslation();
  const dir = useDirection();
  const statsRef = useRef<HTMLDListElement>(null);
  // Numbers count up from 0 the first time the figures scroll into view.
  const inView = useInView(statsRef, { once: true, margin: '0px 0px -15% 0px' });
  const locale = i18n.language === 'ar' ? 'ar-MA' : 'fr-MA';
  const stats = [
    { label: t('story.statCoops'), value: coops },
    { label: t('story.statProducts'), value: produits },
    { label: t('story.statProvinces'), value: provinces },
  ];

  return (
    <section id="histoire" aria-labelledby="histoire-title" className="scroll-mt-20 py-24 sm:py-32">
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-2 lg:gap-20 lg:px-8">
        <motion.div
          custom={dir}
          variants={slideInFromStart}
          initial="hidden"
          whileInView="visible"
          viewport={revealViewport}
          className="relative mx-auto w-full max-w-md"
        >
          <div
            aria-hidden
            className="arch absolute inset-0 -translate-x-4 translate-y-4 bg-terracotta/15 rtl:translate-x-4"
          />
          <Picture
            {...photo('harvest', '(min-width: 1024px) 28rem, 90vw', 1280)}
            alt={t('story.imageAlt')}
            className="arch relative aspect-[4/5] shadow-lifted"
          />
        </motion.div>

        <motion.div
          variants={stagger(0.1)}
          initial="hidden"
          whileInView="visible"
          viewport={revealViewport}
        >
          <motion.p
            variants={fadeUp}
            className="mb-4 flex items-center gap-3 text-xs font-semibold tracking-[0.18em] text-gold-700 uppercase dark:text-gold"
          >
            <span aria-hidden className="h-px w-8 bg-current opacity-60" />
            {t('story.eyebrow')}
          </motion.p>
          <motion.h2
            id="histoire-title"
            variants={fadeUp}
            className="font-display text-display-lg font-semibold"
          >
            {t('story.title')}
          </motion.h2>
          <motion.p
            variants={fadeUp}
            className="mt-6 text-lg leading-relaxed text-muted-foreground"
          >
            {t('story.p1')}
          </motion.p>
          <motion.p
            variants={fadeUp}
            className="mt-4 text-lg leading-relaxed text-muted-foreground"
          >
            {t('story.p2')}
          </motion.p>
          <motion.div variants={fadeUp}>
            <Ornament className="my-10 max-w-sm" />
          </motion.div>
          <motion.dl ref={statsRef} variants={fadeUp} className="grid grid-cols-3 gap-6">
            {stats.map((s) => (
              <div key={s.label}>
                <dt className="text-sm text-muted-foreground">{s.label}</dt>
                <dd className="font-display text-display-md font-semibold text-primary">
                  <NumberFlow value={inView ? s.value : 0} locales={locale} />
                </dd>
              </div>
            ))}
          </motion.dl>
        </motion.div>
      </div>
    </section>
  );
}
