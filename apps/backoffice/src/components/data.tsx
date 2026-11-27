/*
 * Building blocks of the back-office data pages (phase 5): table card with a sticky header,
 * skeleton rows, filter chips, row action menus, a confirmation dialog (replaces window.confirm),
 * the expiry bar and the back link of detail pages. Motion comes from @agricoop/ui/motion presets.
 */
import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableRow,
} from '@agricoop/ui';
import { scaleIn, spring, transition } from '@agricoop/ui/motion';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, ChevronDown, MoreHorizontal, PlusCircle, RotateCcw, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { expiryLevel } from '@/lib/expiry';

/**
 * Card around a data table. From lg up the table scrolls inside the card so its header stays
 * sticky; below, the page scrolls and the table only scrolls sideways.
 */
export function DataCard({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border bg-card shadow-soft',
        'lg:[&_[data-slot=table-container]]:max-h-[calc(100dvh-17rem)]',
        className,
      )}
    >
      {children}
    </div>
  );
}

const SKELETON_WIDTHS = ['w-24', 'w-32', 'w-20', 'w-28', 'w-16', 'w-24', 'w-12', 'w-20'];

/** Placeholder rows while a table loads (same card, no layout jump when data arrives). */
export function TableSkeleton({ columns, rows = 6 }: { columns: number; rows?: number }) {
  const { t } = useTranslation();
  return (
    <DataCard>
      <Table aria-busy="true">
        <TableBody>
          {Array.from({ length: rows }, (_, r) => (
            <TableRow key={r} className="hover:bg-transparent">
              {Array.from({ length: columns }, (_, c) => (
                <TableCell key={c} className="py-3.5">
                  <Skeleton
                    className={cn('h-3.5', SKELETON_WIDTHS[(r + c) % SKELETON_WIDTHS.length])}
                  />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <span className="sr-only" role="status">
        {t('common.loading')}
      </span>
    </DataCard>
  );
}

export interface FilterOption<T extends string> {
  value: T;
  label: string;
}

/**
 * One filter as a chip. Unset: a dashed "+ Label" button that opens the choices. Set: a tinted
 * chip "Label : value" (click to change) with a × to remove it. Chips animate in and out.
 */
export function FilterChip<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T | '';
  options: FilterOption<T>[];
  onChange: (value: T | '') => void;
}) {
  const { t } = useTranslation();
  const current = options.find((o) => o.value === value);
  const menu = (
    <DropdownMenuContent align="start" className="min-w-44">
      <DropdownMenuLabel>{label}</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuRadioGroup value={value} onValueChange={(v) => onChange(v as T)}>
        {options.map((o) => (
          <DropdownMenuRadioItem key={o.value} value={o.value}>
            {o.label}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  );

  return (
    <motion.div layout="position" transition={spring.snappy} className="flex">
      <AnimatePresence mode="popLayout" initial={false}>
        {current ? (
          <motion.div
            key="on"
            variants={scaleIn}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex h-8 items-center rounded-full border border-primary/25 bg-primary/10 text-sm text-primary dark:bg-primary/15"
          >
            <DropdownMenu>
              <DropdownMenuTrigger className="flex h-full items-center gap-1 rounded-s-full ps-3 pe-1.5 outline-none hover:bg-primary/10 focus-visible:ring-[3px] focus-visible:ring-ring/50">
                <span className="text-primary/75">{label} :</span>
                <span className="font-medium">{current.label}</span>
                <ChevronDown className="size-3.5 opacity-70" aria-hidden />
              </DropdownMenuTrigger>
              {menu}
            </DropdownMenu>
            <button
              type="button"
              onClick={() => onChange('')}
              aria-label={t('common.removeFilter', { label })}
              className="grid h-full place-items-center rounded-e-full border-s border-primary/20 px-2 outline-none hover:bg-primary/15 focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </motion.div>
        ) : (
          <motion.div key="off" variants={scaleIn} initial="hidden" animate="visible" exit="exit">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-full border-dashed text-muted-foreground hover:text-foreground"
                >
                  <PlusCircle aria-hidden />
                  {label}
                </Button>
              </DropdownMenuTrigger>
              {menu}
            </DropdownMenu>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/** Row of filter chips (and anything else: tabs, selects), with "reset" when one is set. */
export function FilterBar({
  active,
  onReset,
  children,
  end,
}: {
  active: boolean;
  onReset: () => void;
  children: ReactNode;
  end?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {children}
      <AnimatePresence initial={false}>
        {active && (
          <motion.div
            layout="position"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: transition.ui }}
            exit={{ opacity: 0, transition: transition.fast }}
          >
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-muted-foreground"
              onClick={onReset}
            >
              <RotateCcw aria-hidden /> {t('common.resetFilters')}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
      {end && <div className="ms-auto flex items-center gap-2">{end}</div>}
    </div>
  );
}

/** "⋯" menu at the end of a row. `label` names the row for screen readers. */
export function RowActions({ label, children }: { label: string; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground data-[state=open]:bg-muted data-[state=open]:text-foreground"
          aria-label={`${t('common.actions')} — ${label}`}
        >
          <MoreHorizontal aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const EXPIRY_BAR = {
  perime: 'bg-destructive',
  j30: 'bg-warning',
  j60: 'bg-info',
  j90: 'bg-primary/60',
  ok: 'bg-success',
} as const;

const EXPIRY_TEXT = {
  perime: 'text-destructive',
  j30: 'text-warning-foreground dark:text-warning',
  j60: 'text-info',
  j90: 'text-foreground',
  ok: 'text-success',
} as const;

/**
 * Time left before expiry on a 90-day scale (a full bar = 90 days or more). Grows from the inline
 * start (scaleX, so it mirrors in RTL).
 */
export function ExpiryBar({ jours, className }: { jours: number; className?: string }) {
  const { t } = useTranslation();
  const level = expiryLevel(jours);
  const ratio = Math.min(1, Math.max(0, jours) / 90);
  return (
    <div className={cn('flex min-w-36 items-center gap-2.5', className)}>
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <motion.div
          className={cn(
            'absolute inset-0 origin-left rounded-full rtl:origin-right',
            EXPIRY_BAR[level],
          )}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: level === 'perime' ? 1 : Math.max(ratio, 0.04) }}
          transition={transition.reveal}
        />
      </div>
      <span className={cn('w-14 text-end text-xs font-medium tabular-nums', EXPIRY_TEXT[level])}>
        {level === 'perime' ? t('lotStatut.perime') : t('common.daysShort', { count: jours })}
      </span>
    </div>
  );
}

/** "← Lots" link above a detail page's header. */
export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="group mb-4 inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-offset-4"
    >
      <ArrowLeft
        className="size-4 transition-transform group-hover:-translate-x-0.5 rtl:rotate-180 rtl:group-hover:translate-x-0.5"
        aria-hidden
      />
      {children}
    </Link>
  );
}

/** Label / value pair in a detail card. */
export function DetailItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{children}</dd>
    </div>
  );
}
