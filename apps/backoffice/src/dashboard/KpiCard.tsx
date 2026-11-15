import { Card, cn, Skeleton } from '@agricoop/ui';
import { fadeUp } from '@agricoop/ui/motion';
import NumberFlow from '@number-flow/react';
import { Link } from '@tanstack/react-router';
import { ArrowDownRight, ArrowUpRight, type LucideIcon, Minus } from 'lucide-react';
import { motion, useInView, useReducedMotion } from 'motion/react';
import { useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { useLocale } from '@/components/common';

/**
 * KPI card: value counting up the first time it is seen (NumberFlow), change vs the previous
 * period, and an optional sparkline. Money values are passed as strings (exact).
 */
export function KpiCard({
  label,
  hint,
  icon: Icon,
  value,
  kind = 'count',
  delta,
  deltaLabel,
  spark,
  to,
  tone = 'default',
  loading = false,
  footnote,
  className,
}: {
  label: string;
  hint: string;
  icon: LucideIcon;
  value: string | number | undefined;
  kind?: 'count' | 'money';
  delta?: number | null;
  deltaLabel?: string;
  spark?: { value: number }[];
  to: string;
  tone?: 'default' | 'warning';
  loading?: boolean;
  footnote?: string;
  className?: string;
}) {
  const locale = useLocale();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });

  return (
    <motion.div variants={fadeUp} ref={ref} className={cn('h-full', className)}>
      <Link to={to} className="group block h-full rounded-xl focus-visible:outline-offset-4">
        <Card className="relative h-full gap-3 overflow-hidden px-5 py-5 transition-[box-shadow,border-color] duration-300 group-hover:border-foreground/15 group-hover:shadow-lifted">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <span
              className={cn(
                'grid size-8 place-items-center rounded-lg',
                tone === 'warning'
                  ? 'bg-warning/20 text-warning-foreground dark:text-warning'
                  : 'bg-accent text-primary',
              )}
            >
              <Icon className="size-4" aria-hidden />
            </span>
          </div>
          {loading || value === undefined ? (
            <Skeleton className="h-9 w-32" />
          ) : (
            <p className="font-display text-[1.875rem] leading-none font-semibold tabular-nums">
              <NumberFlow
                value={(inView ? value : 0) as number}
                locales="fr-FR"
                format={
                  kind === 'money'
                    ? { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                    : { maximumFractionDigits: 0 }
                }
                suffix={kind === 'money' ? (locale === 'ar' ? ' د.م.' : ' MAD') : undefined}
              />
            </p>
          )}
          <div className="flex min-h-5 items-center gap-2 text-xs">
            {/* No comparison when the previous period is empty: just say what the figure covers. */}
            {delta !== undefined && delta !== null && <Delta value={delta} />}
            <span className="truncate text-muted-foreground">
              {delta !== undefined && delta !== null ? (deltaLabel ?? hint) : hint}
            </span>
          </div>
          {footnote && <p className="text-[0.6875rem] text-muted-foreground/80">{footnote}</p>}
          {spark && spark.length > 1 && <Sparkline data={spark} />}
        </Card>
      </Link>
    </motion.div>
  );
}

function Delta({ value }: { value: number }) {
  const { t } = useTranslation();
  if (value === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 font-medium text-muted-foreground">
        <Minus className="size-3" aria-hidden /> {t('dashboard.noChange')}
      </span>
    );
  }
  const up = value > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold tabular-nums',
        up ? 'bg-success/12 text-success' : 'bg-destructive/10 text-destructive',
      )}
      dir="ltr"
    >
      <Icon className="size-3" aria-hidden />
      {up ? '+' : ''}
      {value.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %
    </span>
  );
}

/** Tiny area chart under the value (decorative: the figure itself is in the text). */
function Sparkline({ data }: { data: { value: number }[] }) {
  const id = useId().replace(/:/g, '');
  const reduced = useReducedMotion();
  return (
    <div aria-hidden className="-mx-5 -mb-5 h-12" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--chart-2)"
            strokeWidth={1.75}
            fill={`url(#spark-${id})`}
            isAnimationActive={!reduced}
            animationDuration={900}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
