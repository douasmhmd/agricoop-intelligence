import type { LucideIcon } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import type * as React from 'react';
import { cn } from '../lib/cn';
import { fadeUp } from '../motion';
import { BrandMark, ZelligeBackdrop } from './brand';

/*
 * Authentication states inside the apps (redirecting to sign-in, sign-in failed, access denied,
 * sign-in required). Same look as the Keycloak login theme (apps/keycloak-theme): brand, zellige,
 * a lifted card — so app → Keycloak → app feels like one place.
 */
export function AuthScreen({
  icon: Icon,
  title,
  description,
  busy = false,
  tone = 'neutral',
  mirrorIcon = false,
  fullScreen = false,
  brandName = 'AgriCoop',
  children,
}: {
  icon?: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Shows a spinner instead of the icon (e.g. while redirecting to sign-in). */
  busy?: boolean;
  tone?: 'neutral' | 'warning' | 'danger';
  /** Arrow-like icons (sign in / sign out) point the other way in right-to-left languages. */
  mirrorIcon?: boolean;
  /** Whole viewport (before the app shell exists) or inside a page. */
  fullScreen?: boolean;
  brandName?: string;
  /** Actions (buttons, links). */
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'relative isolate grid place-items-center overflow-hidden px-5',
        fullScreen ? 'min-h-dvh bg-background py-10' : 'py-12',
      )}
    >
      <ZelligeBackdrop className="-z-10" />
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="w-full max-w-md text-center"
        role={busy ? 'status' : undefined}
        aria-live={busy ? 'polite' : undefined}
      >
        {fullScreen && (
          <span className="mb-6 inline-flex items-center gap-2 text-primary">
            <BrandMark className="size-8" />
            <span className="font-display text-xl font-semibold text-foreground">{brandName}</span>
          </span>
        )}
        <div className="grid justify-items-center gap-4 rounded-2xl border bg-card px-6 py-10 shadow-lifted sm:px-8">
          <span
            className={cn(
              'grid size-14 place-items-center rounded-t-full rounded-b-xl',
              tone === 'danger'
                ? 'bg-destructive/10 text-destructive'
                : tone === 'warning'
                  ? 'bg-warning/20 text-warning-foreground dark:text-warning'
                  : 'bg-primary text-primary-foreground',
            )}
          >
            {busy ? (
              <Loader2 className="size-6 animate-spin" aria-hidden />
            ) : Icon ? (
              <Icon className={cn('size-6', mirrorIcon && 'rtl:-scale-x-100')} aria-hidden />
            ) : null}
          </span>
          <p className="font-display text-xl font-semibold text-balance">{title}</p>
          {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
          {children && <div className="mt-1 flex flex-wrap justify-center gap-2">{children}</div>}
        </div>
      </motion.div>
    </div>
  );
}
