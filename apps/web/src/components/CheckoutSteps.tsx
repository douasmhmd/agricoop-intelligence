import { cn } from '@agricoop/ui';
import { ease } from '@agricoop/ui/motion';
import { Check } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

const STEPS = ['stepCart', 'stepDelivery', 'stepPayment', 'stepDone'] as const;

/**
 * Journey indicator: cart → delivery → payment (hosted page) → confirmation. The gold line grows
 * to the current step (scaleX from the inline start, so it mirrors in RTL).
 */
/** `current`: index of the step in progress; 4 = everything done (order paid). */
export function CheckoutSteps({ current }: { current: 0 | 1 | 2 | 3 | 4 }) {
  const { t } = useTranslation();
  return (
    <nav aria-label={t('checkout.steps')} className="mx-auto w-full max-w-2xl">
      <ol className="relative grid grid-cols-4">
        <div aria-hidden className="absolute inset-x-[12.5%] top-4 h-0.5 rounded-full bg-border" />
        <motion.div
          aria-hidden
          className="absolute inset-x-[12.5%] top-4 h-0.5 origin-left rounded-full bg-gold rtl:origin-right"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: Math.min(current, STEPS.length - 1) / (STEPS.length - 1) }}
          transition={{ duration: 0.8, ease: ease.out, delay: 0.15 }}
        />
        {STEPS.map((key, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li
              key={key}
              aria-current={active ? 'step' : undefined}
              className="relative flex flex-col items-center gap-2 text-center"
            >
              <span
                className={cn(
                  'relative z-10 grid size-8 place-items-center rounded-full border-2 text-xs font-bold transition-colors duration-500',
                  done && 'border-gold bg-gold text-gold-foreground',
                  active &&
                    'border-gold bg-card text-gold-700 shadow-[0_0_0_4px_color-mix(in_oklch,var(--gold)_20%,transparent)] dark:text-gold',
                  !done && !active && 'border-border bg-card text-muted-foreground',
                )}
              >
                {done ? <Check className="size-4" aria-hidden /> : i + 1}
              </span>
              <span
                className={cn(
                  'text-xs font-medium sm:text-sm',
                  active || done ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {t(`checkout.${key}`)}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

const COLORS = ['var(--gold)', 'var(--primary)', 'var(--terracotta)', 'var(--color-olive-300)'];

/** A small, tasteful burst (28 pieces, once). Transform/opacity only; none with reduced motion. */
export function Confetti() {
  const reduced = useReducedMotion();
  const [pieces] = useState(() =>
    Array.from({ length: 28 }, (_, i) => {
      const angle = (i / 28) * Math.PI * 2 + Math.random() * 0.4;
      const distance = 90 + Math.random() * 120;
      return {
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance * 0.7 - 40,
        rotate: Math.random() * 540 - 270,
        color: COLORS[i % COLORS.length]!,
        round: i % 3 === 0,
        delay: Math.random() * 0.12,
      };
    }),
  );
  if (reduced) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-8 z-20 flex justify-center"
    >
      {pieces.map((p, i) => (
        <motion.span
          key={i}
          className={cn('absolute h-2.5 w-1.5', p.round && 'size-2 rounded-full')}
          style={{ background: p.color }}
          initial={{ x: 0, y: 0, rotate: 0, opacity: 1, scale: 0.6 }}
          animate={{
            x: p.x,
            y: [0, p.y, p.y + 140],
            rotate: p.rotate,
            opacity: [1, 1, 0],
            scale: 1,
          }}
          transition={{ duration: 1.7, ease: ease.out, delay: p.delay, times: [0, 0.45, 1] }}
        />
      ))}
    </div>
  );
}
