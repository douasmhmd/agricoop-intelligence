import { Button, Picture, ZelligeBackdrop } from '@agricoop/ui';
import { fadeUp, stagger, transition, wordReveal } from '@agricoop/ui/motion';
import { Link } from '@tanstack/react-router';
import { ArrowRight, BadgeCheck, Leaf, ScanLine, Sprout } from 'lucide-react';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { photo } from '@/lib/images';
import { useSkipIntro } from '@/lib/prerender';

/**
 * Full-height hero: word-by-word serif headline, two CTAs, and the olive grove in a Moroccan arch
 * with a gentle parallax (off with reduced motion).
 */
export function Hero() {
  const { t } = useTranslation();
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const imageY = useTransform(scrollYProgress, [0, 1], ['0%', '16%']);
  const frameY = useTransform(scrollYProgress, [0, 1], ['0%', '-6%']);
  const words = t('hero.title').split(' ');
  // Booting over the pre-rendered shell: show the final state at once (no replay).
  const skipIntro = useSkipIntro();

  return (
    <section
      ref={ref}
      aria-labelledby="hero-title"
      className="grain relative isolate flex min-h-[100svh] items-center overflow-hidden pt-24 pb-20 lg:pt-28"
    >
      <ZelligeBackdrop className="-z-10" />
      <div
        aria-hidden
        className="absolute -top-40 -z-10 size-[42rem] rounded-full bg-gold/15 blur-3xl ltr:-right-40 rtl:-left-40 dark:bg-gold/10"
      />

      <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16 lg:px-8">
        <motion.div
          variants={stagger(0.12, 0.05)}
          initial={skipIntro ? false : 'hidden'}
          animate="visible"
        >
          <motion.p
            variants={fadeUp}
            className="mb-6 flex items-center gap-3 text-xs font-semibold tracking-[0.2em] text-gold-700 uppercase dark:text-gold"
          >
            <span aria-hidden className="h-px w-10 bg-current opacity-60" />
            {t('hero.eyebrow')}
          </motion.p>

          <motion.h1
            id="hero-title"
            variants={stagger(0.07)}
            className="font-display text-display-2xl font-semibold text-balance"
          >
            {words.map((word, i) => (
              <span
                key={`${word}-${i}`}
                className="inline-block overflow-hidden pb-[0.12em] align-bottom"
              >
                <motion.span variants={wordReveal} className="inline-block">
                  {word}
                </motion.span>
                {i < words.length - 1 && ' '}
              </span>
            ))}
          </motion.h1>

          {/* Static on purpose: this paragraph is the page's largest text (LCP); fading it in
              would delay the first meaningful paint. The headline still reveals word by word. */}
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
            {t('home.intro')}
          </p>

          <motion.div variants={fadeUp} className="mt-9 flex flex-wrap items-center gap-3">
            <Button asChild size="xl" shape="pill" variant="gold" className="group">
              <Link to="/" hash="produits">
                {t('hero.cta')}
                <ArrowRight className="size-5 transition-transform duration-300 ease-out-expo group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
              </Link>
            </Button>
            <Button asChild size="xl" shape="pill" variant="outline" className="group">
              <Link to="/" hash="authenticite">
                <ScanLine className="size-5 transition-transform duration-300 ease-out-expo group-hover:scale-110" />
                {t('hero.verify')}
              </Link>
            </Button>
          </motion.div>

          <motion.ul
            variants={fadeUp}
            className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted-foreground"
          >
            {[
              { Icon: Leaf, label: t('hero.coldPressed') },
              { Icon: ScanLine, label: t('hero.traceable') },
              { Icon: Sprout, label: t('hero.direct') },
            ].map(({ Icon, label }) => (
              <li key={label} className="flex items-center gap-2">
                <Icon className="size-4 text-primary" aria-hidden />
                {label}
              </li>
            ))}
          </motion.ul>
        </motion.div>

        <motion.div
          initial={skipIntro ? false : { opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ ...transition.hero, delay: 0.25 }}
          className="relative mx-auto w-full max-w-[26rem] lg:max-w-[30rem]"
        >
          {/* Thin gold arch drawn behind the photo, drifting the other way. */}
          <motion.div
            aria-hidden
            style={reduced ? undefined : { y: frameY }}
            className="arch absolute inset-0 translate-x-4 translate-y-4 border border-gold/60 rtl:-translate-x-4"
          />
          <div className="arch relative aspect-[4/5] shadow-float">
            <motion.div
              style={reduced ? undefined : { y: imageY }}
              className="absolute inset-x-0 -top-[8%] h-[116%]"
            >
              <Picture
                {...photo('grove', '(min-width: 1024px) 30rem, 90vw')}
                alt={t('hero.imageAlt')}
                priority
                className="size-full"
              />
            </motion.div>
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-olive-950/35 via-transparent to-transparent"
            />
          </div>

          <FloatingChip className="-start-4 bottom-10 sm:-start-10" delay={0.9}>
            <BadgeCheck className="size-5 text-success" aria-hidden />
            {t('hero.badgeVerified')}
          </FloatingChip>
          <FloatingChip className="-end-2 top-14 sm:-end-8" delay={1.1} slow>
            <Leaf className="size-5 text-gold" aria-hidden />
            {t('hero.badgeHarvest')}
          </FloatingChip>
        </motion.div>
      </div>

      <ScrollCue label={t('hero.scroll')} />
    </section>
  );
}

function FloatingChip({
  className,
  delay,
  slow = false,
  children,
}: {
  className: string;
  delay: number;
  slow?: boolean;
  children: React.ReactNode;
}) {
  const skipIntro = useSkipIntro();
  return (
    <motion.div
      initial={skipIntro ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...transition.reveal, delay }}
      className={`absolute ${className}`}
    >
      <div
        className={`glass flex items-center gap-2 rounded-full border border-white/40 px-4 py-2.5 text-sm font-semibold shadow-lifted dark:border-white/10 ${slow ? 'animate-float [animation-delay:1.2s]' : 'animate-float'}`}
      >
        {children}
      </div>
    </motion.div>
  );
}

function ScrollCue({ label }: { label: string }) {
  return (
    <Link
      to="/"
      hash="histoire"
      aria-label={label}
      className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-xs tracking-[0.2em] text-muted-foreground uppercase transition-colors hover:text-foreground md:flex [@media(max-height:700px)]:hidden"
    >
      <span className="relative flex h-9 w-5.5 justify-center rounded-full border-2 border-current">
        <motion.span
          aria-hidden
          className="mt-1.5 size-1 rounded-full bg-current"
          animate={{ y: [0, 10, 0], opacity: [1, 0.2, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        />
      </span>
      <span aria-hidden>{label}</span>
    </Link>
  );
}
