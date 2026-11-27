import { Card, CardDescription, CardHeader, CardTitle, Skeleton } from '@agricoop/ui';
import { fadeUp } from '@agricoop/ui/motion';
import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AXIS } from './chart-style';
import type { ForecastPoint } from './metrics';

/*
 * Recharts restyled: soft grid, no axis lines, gradient areas, branded tooltip, animated entry
 * (off with reduced motion). Charts stay left-to-right inside Arabic pages (time reads LTR).
 */

export function ChartCard({
  title,
  description,
  className,
  children,
}: {
  title: string;
  description?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <motion.div variants={fadeUp} className={className}>
      <Card className="h-full gap-4 py-5">
        <CardHeader className="px-5">
          <CardTitle className="text-base">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <div className="px-3">{children}</div>
      </Card>
    </motion.div>
  );
}

export function ChartEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="grid h-64 place-items-center px-4 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

export function ChartSkeleton() {
  return <Skeleton className="mx-2 h-64 rounded-lg" />;
}

/** Tooltip in the brand: popover surface, coloured dots, tabular numbers. */
interface TooltipEntry {
  dataKey?: unknown;
  name?: string | number;
  value?: unknown;
  color?: string;
}

export function BrandTooltip({
  active,
  payload,
  label,
  formatLabel,
}: {
  active?: boolean;
  payload?: readonly TooltipEntry[];
  label?: unknown;
  formatLabel?: (label: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-36 rounded-xl border border-border/70 bg-popover/95 px-3 py-2.5 text-xs shadow-float backdrop-blur">
      <p className="mb-1.5 font-medium text-foreground">
        {formatLabel ? formatLabel(String(label)) : String(label)}
      </p>
      <ul className="grid gap-1">
        {payload.map((p) => (
          <li key={String(p.dataKey)} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="size-2 rounded-full" style={{ background: p.color }} />
              {p.name}
            </span>
            <span className="font-semibold tabular-nums text-foreground">
              {typeof p.value === 'number'
                ? p.value.toLocaleString('fr-FR', { maximumFractionDigits: 1 })
                : '—'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Weekly units sold (gradient area) against the model's forecast (dashed line). */
export function SalesForecastChart({ data }: { data: ForecastPoint[] }) {
  const { t, i18n } = useTranslation();
  const reduced = useReducedMotion();
  const fmtWeek = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language === 'ar' ? 'ar-MA' : 'fr-MA', {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    }).format(new Date(`${iso}T00:00:00Z`));
  return (
    <div className="h-72" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
          <defs>
            <linearGradient id="sales-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.32} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
          <XAxis
            dataKey="semaine"
            tickFormatter={fmtWeek}
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
          />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} allowDecimals={false} />
          <Tooltip
            content={<BrandTooltip formatLabel={fmtWeek} />}
            cursor={{ stroke: 'var(--border)', strokeWidth: 1 }}
          />
          <Area
            type="monotone"
            dataKey="vendues"
            name={t('dashboard.sold')}
            stroke="var(--chart-1)"
            strokeWidth={2}
            fill="url(#sales-fill)"
            isAnimationActive={!reduced}
            animationDuration={1000}
          />
          <Line
            type="monotone"
            dataKey="prevues"
            name={t('dashboard.forecast')}
            stroke="var(--chart-2)"
            strokeWidth={2}
            strokeDasharray="6 5"
            // A model that forecasts only the next week or two would draw no visible line: show
            // its points as dots instead.
            dot={
              data.filter((d) => d.prevues !== null).length <= 2
                ? { r: 4, fill: 'var(--chart-2)', strokeWidth: 0 }
                : false
            }
            connectNulls={false}
            isAnimationActive={!reduced}
            animationDuration={1000}
            animationBegin={250}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal bars (stock per famille, scans per city). */
export function BarList({
  data,
  valueName,
  colors,
}: {
  data: { label: string; value: number }[];
  valueName: string;
  colors?: string[];
}) {
  const reduced = useReducedMotion();
  return (
    <div style={{ height: Math.max(176, data.length * 40) }} dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 8 }}>
          <defs>
            <linearGradient id="bar-fill" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.75} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={1} />
            </linearGradient>
          </defs>
          <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 4" />
          <XAxis
            type="number"
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            tick={{ ...AXIS, fill: 'var(--foreground)' }}
            tickLine={false}
            axisLine={false}
            width={96}
          />
          <Tooltip content={<BrandTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.5 }} />
          <Bar
            dataKey="value"
            name={valueName}
            radius={[0, 6, 6, 0]}
            barSize={18}
            fill="url(#bar-fill)"
            isAnimationActive={!reduced}
            animationDuration={900}
          >
            {colors && data.map((d, i) => <Cell key={d.label} fill={colors[i % colors.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
