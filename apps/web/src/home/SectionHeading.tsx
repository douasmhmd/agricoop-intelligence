import { cn } from '@agricoop/ui';
import { fadeUp, revealViewport, stagger } from '@agricoop/ui/motion';
import { motion } from 'motion/react';
import type { ReactNode } from 'react';

/** Eyebrow (gold, with a hairline) + serif title + optional lead, revealed on scroll. */
export function SectionHeading({
  id,
  eyebrow,
  title,
  lead,
  align = 'start',
  tone = 'default',
  className,
  children,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  lead?: string;
  align?: 'start' | 'center';
  tone?: 'default' | 'inverted';
  className?: string;
  children?: ReactNode;
}) {
  return (
    <motion.div
      variants={stagger(0.08)}
      initial="hidden"
      whileInView="visible"
      viewport={revealViewport}
      className={cn(
        'flex flex-wrap items-end justify-between gap-6',
        align === 'center' && 'flex-col items-center text-center',
        className,
      )}
    >
      <div className={cn('max-w-2xl space-y-3', align === 'center' && 'mx-auto')}>
        <motion.p
          variants={fadeUp}
          className={cn(
            'flex items-center gap-3 text-xs font-semibold tracking-[0.18em] uppercase',
            tone === 'inverted' ? 'text-gold-300' : 'text-gold-700 dark:text-gold',
            align === 'center' && 'justify-center',
          )}
        >
          <span aria-hidden className="h-px w-8 bg-current opacity-60" />
          {eyebrow}
        </motion.p>
        <motion.h2
          id={id}
          variants={fadeUp}
          className="font-display text-display-lg font-semibold text-balance"
        >
          {title}
        </motion.h2>
        {lead && (
          <motion.p
            variants={fadeUp}
            className={cn(
              'text-lg leading-relaxed',
              tone === 'inverted' ? 'text-olive-100/80' : 'text-muted-foreground',
            )}
          >
            {lead}
          </motion.p>
        )}
      </div>
      {children && <motion.div variants={fadeUp}>{children}</motion.div>}
    </motion.div>
  );
}
