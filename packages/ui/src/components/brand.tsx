import { motion } from 'motion/react';
import type * as React from 'react';
import { cn } from '../lib/cn';
import { spring } from '../motion';
import type { ThemePreference } from '../lib/theme';
import { useTheme } from '../lib/theme';
import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react';

/** Olive sprig mark: two leaves and a fruit. Inherits currentColor; the fruit is gold. */
function BrandMark({ className, ...props }: React.ComponentProps<'svg'>) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className={cn('size-7', className)} {...props}>
      <path
        d="M7 25.5C11.5 21 17 15.5 26 7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M14.2 18.6c-4.3.2-7.6-1.6-9.2-5.3 4.2-.5 7.6 1.3 9.2 5.3Z"
        fill="currentColor"
        opacity=".9"
      />
      <path
        d="M19.6 13.1c-.5-4.3 1-7.7 4.6-9.6.8 4.1-.8 7.6-4.6 9.6Z"
        fill="currentColor"
        opacity=".75"
      />
      <ellipse
        cx="21.5"
        cy="18.5"
        rx="3.2"
        ry="4.1"
        transform="rotate(-35 21.5 18.5)"
        fill="var(--gold)"
      />
      <ellipse
        cx="20.6"
        cy="17.2"
        rx=".9"
        ry="1.3"
        transform="rotate(-35 20.6 17.2)"
        fill="#fff"
        opacity=".45"
      />
    </svg>
  );
}

/** Thin gold divider with an 8-point star in the middle (section separators). */
function Ornament({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div aria-hidden className={cn('flex items-center gap-3 text-gold', className)} {...props}>
      <span className="hairline-gold flex-1" />
      <svg viewBox="0 0 24 24" className="size-3.5 shrink-0" fill="none">
        <path
          d="M12 2l2.6 6.4L21 12l-6.4 2.6L12 22l-2.6-7.4L3 12l6.4-3.6z"
          fill="currentColor"
          opacity=".9"
        />
        <rect x="7.2" y="7.2" width="9.6" height="9.6" stroke="currentColor" strokeWidth="1" />
      </svg>
      <span className="hairline-gold flex-1" />
    </div>
  );
}

/**
 * Faint zellige lattice behind a section (hero, footer, empty states). Place inside a `relative`
 * parent; `fade` softens the pattern towards the edges.
 */
function ZelligeBackdrop({
  className,
  fade = 'radial',
}: {
  className?: string;
  fade?: 'radial' | 'bottom' | 'none';
}) {
  // Outer layer: the edge fade. Inner layer: the lattice. Nested masks multiply.
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-0',
        fade === 'radial' &&
          '[mask-image:radial-gradient(ellipse_at_center,black_15%,transparent_72%)]',
        fade === 'bottom' && '[mask-image:linear-gradient(to_bottom,transparent,black_70%)]',
        className,
      )}
    >
      <div className="zellige absolute inset-0 text-primary/[0.09] dark:text-gold/[0.07]" />
    </div>
  );
}

const THEME_OPTIONS: { value: ThemePreference; Icon: typeof SunIcon }[] = [
  { value: 'light', Icon: SunIcon },
  { value: 'dark', Icon: MoonIcon },
  { value: 'system', Icon: MonitorIcon },
];

/** Segmented light / dark / system control. Pass translated labels from the app. */
function ThemeToggle({
  labels,
  className,
}: {
  labels: { group: string; light: string; dark: string; system: string };
  className?: string;
}) {
  const { preference, setPreference } = useTheme();
  return (
    <div
      role="radiogroup"
      aria-label={labels.group}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full border border-border/70 bg-muted/60 p-0.5',
        className,
      )}
    >
      {THEME_OPTIONS.map(({ value, Icon }) => {
        const active = preference === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={labels[value]}
            title={labels[value]}
            onClick={() => setPreference(value)}
            className="relative grid size-7 cursor-pointer place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground aria-checked:text-foreground"
          >
            {active && (
              <motion.span
                layoutId="theme-toggle-thumb"
                className="absolute inset-0 rounded-full bg-card shadow-soft"
                transition={spring.snappy}
              />
            )}
            <Icon className="relative size-3.5" />
          </button>
        );
      })}
    </div>
  );
}

export { BrandMark, Ornament, ThemeToggle, ZelligeBackdrop };
