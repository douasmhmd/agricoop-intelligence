/*
 * Motion presets — the single source of timing for both apps (Motion for React).
 *
 * Rules (docs/ui-design.md):
 * - UI feedback 150–300 ms; hero reveals up to 800 ms. Never the linear default.
 * - Animate transform and opacity only.
 * - Scroll reveals: `whileInView` + `viewport={revealViewport}` (once).
 * - RTL: horizontal offsets go through `inlineOffset()` / the `custom` direction so they mirror.
 * - Reduced motion: apps wrap everything in <MotionProvider> (MotionConfig reducedMotion="user"),
 *   which keeps opacity and drops transforms.
 * - The back office animates less than the storefront: use `ui*` presets there, `reveal*` on the
 *   storefront.
 */
import type { Transition, Variants } from 'motion/react';

export type Direction = 'ltr' | 'rtl';

/** Cubic-bezier curves (same values as the CSS --ease-* tokens). */
export const ease = {
  out: [0.16, 1, 0.3, 1],
  outQuart: [0.25, 1, 0.5, 1],
  inOut: [0.83, 0, 0.17, 1],
  emphasized: [0.2, 0, 0, 1],
} as const;

/** Seconds. */
export const duration = {
  fast: 0.15,
  base: 0.22,
  slow: 0.3,
  reveal: 0.6,
  hero: 0.8,
} as const;

export const spring = {
  /** Toggles, indicators, small elements. */
  snappy: { type: 'spring', stiffness: 520, damping: 38, mass: 0.8 },
  /** Dialogs, sheets, cards. */
  soft: { type: 'spring', stiffness: 300, damping: 30 },
  /** Playful feedback (cart badge bounce). */
  bouncy: { type: 'spring', stiffness: 460, damping: 15 },
} as const satisfies Record<string, Transition>;

export const transition = {
  ui: { duration: duration.base, ease: ease.out },
  fast: { duration: duration.fast, ease: ease.out },
  reveal: { duration: duration.reveal, ease: ease.out },
  hero: { duration: duration.hero, ease: ease.out },
} as const satisfies Record<string, Transition>;

/** Scroll reveals play once, a little before the element is fully in view. */
export const revealViewport = { once: true, margin: '0px 0px -12% 0px' } as const;

/** Signed horizontal offset that mirrors in RTL: positive = towards the inline end. */
export function inlineOffset(px: number, dir: Direction): number {
  return dir === 'rtl' ? -px : px;
}

export const fade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: transition.ui },
  exit: { opacity: 0, transition: transition.fast },
};

/** Fade + rise. `custom` = distance in px (default 16). */
export const fadeUp: Variants = {
  hidden: (distance: number = 16) => ({ opacity: 0, y: distance }),
  visible: { opacity: 1, y: 0, transition: transition.reveal },
  exit: { opacity: 0, y: 8, transition: transition.fast },
};

/** Compact variant for UI (dashboard rows, toasts, validation messages). */
export const fadeUpSmall: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: transition.ui },
  exit: { opacity: 0, y: -4, transition: transition.fast },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: spring.soft },
  exit: { opacity: 0, scale: 0.98, transition: transition.fast },
};

/** Slides in from the inline START (left in LTR, right in RTL). `custom` = direction. */
export const slideInFromStart: Variants = {
  hidden: (dir: Direction = 'ltr') => ({ opacity: 0, x: inlineOffset(-24, dir) }),
  visible: { opacity: 1, x: 0, transition: transition.reveal },
  exit: (dir: Direction = 'ltr') => ({
    opacity: 0,
    x: inlineOffset(-12, dir),
    transition: transition.fast,
  }),
};

/** Slides in from the inline END (right in LTR, left in RTL). `custom` = direction. */
export const slideInFromEnd: Variants = {
  hidden: (dir: Direction = 'ltr') => ({ opacity: 0, x: inlineOffset(24, dir) }),
  visible: { opacity: 1, x: 0, transition: transition.reveal },
  exit: (dir: Direction = 'ltr') => ({
    opacity: 0,
    x: inlineOffset(12, dir),
    transition: transition.fast,
  }),
};

/** Parent variants that stagger their children's `hidden → visible`. */
export function stagger(each = 0.06, delayChildren = 0): Variants {
  return {
    hidden: {},
    visible: { transition: { staggerChildren: each, delayChildren } },
  };
}

/** Word-by-word headline reveal (storefront hero): parent = stagger(0.07), child = wordReveal. */
export const wordReveal: Variants = {
  hidden: { opacity: 0, y: '0.6em' },
  visible: { opacity: 1, y: 0, transition: transition.hero },
};

/** Micro-interactions for pressable elements. */
export const press = { whileTap: { scale: 0.97 }, transition: spring.snappy } as const;
