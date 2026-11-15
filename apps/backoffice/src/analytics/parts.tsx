import { Card, CardDescription, CardHeader, CardTitle, cn } from '@agricoop/ui';
import { fadeUp } from '@agricoop/ui/motion';
import { CalendarClock, type LucideIcon } from 'lucide-react';
import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { DateText } from '@/components/common';

/** A figure with its label (no link, unlike the dashboard's KpiCard). */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon: LucideIcon;
  tone?: 'default' | 'warning' | 'danger';
}) {
  return (
    <motion.div variants={fadeUp} className="h-full">
      <Card className="h-full gap-2 px-5 py-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <span
            className={cn(
              'grid size-8 place-items-center rounded-lg',
              tone === 'danger'
                ? 'bg-destructive/15 text-destructive'
                : tone === 'warning'
                  ? 'bg-warning/20 text-warning-foreground dark:text-warning'
                  : 'bg-accent text-primary',
            )}
          >
            <Icon className="size-4" aria-hidden />
          </span>
        </div>
        <p className="font-display text-2xl leading-tight font-semibold tabular-nums">{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </Card>
    </motion.div>
  );
}

/** A titled card holding a table or a chart. */
export function Section({
  title,
  description,
  aside,
  className,
  children,
}: {
  title: string;
  description?: string;
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    // min-w-0: inside a grid, a wide table must scroll in its card, not widen the column.
    <motion.div variants={fadeUp} className={cn('min-w-0', className)}>
      <Card className="h-full gap-0 py-0">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
          <div className="grid gap-1">
            <CardTitle className="text-base">{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          {aside}
        </CardHeader>
        {children}
      </Card>
    </motion.div>
  );
}

/** Rows of a table inside a Section: scrolls sideways on small screens. */
export function TableScroll({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto">{children}</div>;
}

/** Message inside a Section with no rows. */
export function SectionEmpty({ children }: { children: ReactNode }) {
  return <p className="px-5 py-8 text-center text-sm text-muted-foreground">{children}</p>;
}

/** "Données au 1 oct. 2026": the analysis date of the stock routes. */
export function DataDate({ value }: { value: string | null }) {
  const { t } = useTranslation();
  if (!value) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
      <CalendarClock className="size-3.5" aria-hidden />
      {t('analyses.dataAt')} <DateText value={value} />
    </span>
  );
}
