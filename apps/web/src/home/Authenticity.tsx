import { ZelligeBackdrop } from '@agricoop/ui';
import { ease, fadeUp, revealViewport, stagger } from '@agricoop/ui/motion';
import { Camera, ShieldCheck, ShoppingBag } from 'lucide-react';
import { motion, useInView, useReducedMotion } from 'motion/react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { SectionHeading } from './SectionHeading';

/** "Authenticité garantie par QR": three steps and an animated phone scanning a label. */
export function Authenticity() {
  const { t } = useTranslation();
  const steps = [
    { Icon: Camera, title: t('qr.step1'), text: t('qr.step1Text') },
    { Icon: ShieldCheck, title: t('qr.step2'), text: t('qr.step2Text') },
    { Icon: ShoppingBag, title: t('qr.step3'), text: t('qr.step3Text') },
  ];
  return (
    <section
      id="authenticite"
      aria-labelledby="authenticite-title"
      className="relative isolate scroll-mt-20 overflow-hidden bg-olive-950 py-24 text-olive-50 sm:py-32"
    >
      <ZelligeBackdrop className="-z-10 [&>div]:text-gold/[0.08]" fade="radial" />
      <div className="mx-auto grid max-w-7xl items-center gap-16 px-4 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
        <div>
          <SectionHeading
            id="authenticite-title"
            eyebrow={t('qr.eyebrow')}
            title={t('qr.title')}
            lead={t('qr.text')}
            tone="inverted"
          />
          <motion.ol
            variants={stagger(0.1)}
            initial="hidden"
            whileInView="visible"
            viewport={revealViewport}
            className="mt-12 grid gap-6 sm:grid-cols-3"
          >
            {steps.map(({ Icon, title, text }, i) => (
              <motion.li key={title} variants={fadeUp} className="relative">
                <div className="flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-full border border-gold/40 bg-gold/10 text-gold-300">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="font-display text-sm text-gold-300/80" aria-hidden>
                    0{i + 1}
                  </span>
                </div>
                <h3 className="mt-4 font-semibold text-white">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-olive-100/75">{text}</p>
              </motion.li>
            ))}
          </motion.ol>
        </div>
        <ScanIllustration label={t('qr.illustration')} authentic={t('qr.authentic')} />
      </div>
    </section>
  );
}

/** Deterministic QR-like 21×21 pattern (decorative, not a real code). */
const QR_CELLS = Array.from({ length: 21 * 21 }, (_, i) => {
  const x = i % 21;
  const y = Math.floor(i / 21);
  const finder = (cx: number, cy: number) =>
    x >= cx && x < cx + 7 && y >= cy && y < cy + 7
      ? Math.max(Math.abs(x - cx - 3), Math.abs(y - cy - 3)) !== 2
      : null;
  const f = finder(0, 0) ?? finder(14, 0) ?? finder(0, 14);
  if (f !== null) return f;
  return (x * 7 + y * 13 + x * y) % 5 < 2;
});

function ScanIllustration({ label, authentic }: { label: string; authentic: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -20% 0px' });
  const reduced = useReducedMotion();
  return (
    <div ref={ref} role="img" aria-label={label} className="relative mx-auto w-full max-w-[22rem]">
      <div aria-hidden className="absolute inset-8 -z-10 rounded-full bg-gold/25 blur-3xl" />
      {/* Phone */}
      <div className="relative mx-auto aspect-[9/18] w-[72%] rounded-[2.4rem] border border-white/15 bg-gradient-to-b from-olive-900 to-black p-3 shadow-float">
        <div className="relative size-full overflow-hidden rounded-[1.8rem] bg-sand-100">
          <div className="absolute inset-x-0 top-0 flex justify-center pt-2">
            <span className="h-1.5 w-14 rounded-full bg-black/80" />
          </div>
          {/* Viewfinder with the QR code */}
          <div className="absolute inset-x-[14%] top-[18%] aspect-square">
            <svg viewBox="0 0 21 21" className="size-full" shapeRendering="crispEdges" aria-hidden>
              {QR_CELLS.map((on, i) =>
                on ? (
                  <rect
                    key={i}
                    x={i % 21}
                    y={Math.floor(i / 21)}
                    width="1"
                    height="1"
                    fill="#1c2410"
                  />
                ) : null,
              )}
            </svg>
            {[
              'top-0 start-0 border-t-3 border-s-3',
              'top-0 end-0 border-t-3 border-e-3',
              'bottom-0 start-0 border-b-3 border-s-3',
              'bottom-0 end-0 border-b-3 border-e-3',
            ].map((c) => (
              <span key={c} className={`absolute -m-2 size-6 rounded-sm border-gold ${c}`} />
            ))}
            {!reduced && (
              // The wrapper is as tall as the code, so translating it by 100% sweeps the line
              // from top to bottom with a transform (no layout animation).
              <motion.div
                aria-hidden
                className="absolute inset-0"
                initial={{ y: '0%', opacity: 0 }}
                animate={inView ? { y: ['0%', '100%', '0%', '100%'], opacity: [0, 1, 1, 0] } : {}}
                transition={{ duration: 2.4, ease: 'easeInOut' }}
              >
                <span className="absolute inset-x-[-6%] top-0 h-0.5 rounded-full bg-gold shadow-[0_0_14px_3px_var(--gold)]" />
              </motion.div>
            )}
          </div>
          {/* Result card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, ease: ease.out, delay: reduced ? 0.2 : 2.3 }}
            className="absolute inset-x-[8%] bottom-[7%] flex items-center gap-2.5 rounded-2xl bg-white p-3 shadow-lifted"
          >
            <svg viewBox="0 0 32 32" className="size-9 shrink-0" aria-hidden>
              <circle cx="16" cy="16" r="15" fill="oklch(0.5 0.115 150)" />
              <motion.path
                d="M9.5 16.5l4.5 4.5 8.5-9"
                fill="none"
                stroke="white"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={inView ? { pathLength: 1 } : {}}
                transition={{ duration: 0.45, ease: ease.out, delay: reduced ? 0.3 : 2.6 }}
              />
            </svg>
            <div className="min-w-0 text-start">
              <p className="text-sm font-bold text-olive-900">{authentic}</p>
              <p className="truncate text-[0.6875rem] text-olive-700">HVE-1L · 2026</p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
