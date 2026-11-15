import { useReducedMotion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AXIS } from '@/dashboard/chart-style';
import { BrandTooltip } from '@/dashboard/charts';
import { monthLabel } from './insights';

/* Same chart language as the dashboard (dashboard/charts.tsx); charts stay LTR in Arabic pages. */

const compact = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });

/** Monthly revenue and margin (bars) with the order count (line, right axis). */
export function MonthlyChart({
  data,
  locale,
}: {
  data: { mois: string; ca: number; marge: number; commandes: number }[];
  locale: 'fr' | 'ar';
}) {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const fmt = (m: string) => monthLabel(m, locale);
  return (
    <div className="h-72" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -4 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
          <XAxis dataKey="mois" tickFormatter={fmt} tick={AXIS} tickLine={false} axisLine={false} />
          <YAxis
            yAxisId="mad"
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={(v: number) => compact.format(v)}
          />
          <YAxis
            yAxisId="count"
            orientation="right"
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            width={36}
            allowDecimals={false}
          />
          <Tooltip
            content={<BrandTooltip formatLabel={fmt} />}
            cursor={{ fill: 'var(--muted)', opacity: 0.5 }}
          />
          <Bar
            yAxisId="mad"
            dataKey="ca"
            name={t('analyses.ventes.ca')}
            fill="var(--chart-1)"
            radius={[5, 5, 0, 0]}
            maxBarSize={28}
            isAnimationActive={!reduced}
            animationDuration={900}
          />
          <Bar
            yAxisId="mad"
            dataKey="marge"
            name={t('analyses.ventes.marge')}
            fill="var(--chart-3)"
            radius={[5, 5, 0, 0]}
            maxBarSize={28}
            isAnimationActive={!reduced}
            animationDuration={900}
            animationBegin={150}
          />
          <Line
            yAxisId="count"
            type="monotone"
            dataKey="commandes"
            name={t('analyses.ventes.commandes')}
            stroke="var(--chart-2)"
            strokeWidth={2}
            dot={{ r: 3, fill: 'var(--chart-2)', strokeWidth: 0 }}
            isAnimationActive={!reduced}
            animationDuration={900}
            animationBegin={300}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Share of customers vs share of revenue per segment, in percent. */
export function SegmentChart({ data }: { data: { label: string; clients: number; ca: number }[] }) {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  return (
    <div style={{ height: Math.max(220, data.length * 56) }} dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 16, bottom: 0, left: 8 }}
          barGap={3}
        >
          <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 4" />
          <XAxis
            type="number"
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            unit=" %"
            domain={[0, 'auto']}
          />
          <YAxis
            type="category"
            dataKey="label"
            tick={{ ...AXIS, fill: 'var(--foreground)' }}
            tickLine={false}
            axisLine={false}
            width={128}
          />
          <Tooltip content={<BrandTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.5 }} />
          <Bar
            dataKey="clients"
            name={t('analyses.clients.partClients')}
            fill="var(--chart-1)"
            radius={[0, 5, 5, 0]}
            barSize={12}
            isAnimationActive={!reduced}
            animationDuration={900}
          />
          <Bar
            dataKey="ca"
            name={t('analyses.clients.partCa')}
            fill="var(--chart-2)"
            radius={[0, 5, 5, 0]}
            barSize={12}
            isAnimationActive={!reduced}
            animationDuration={900}
            animationBegin={150}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Two-series legend under a chart. */
export function ChartLegend({
  items,
}: {
  items: { label: string; color: string; line?: boolean }[];
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-5 pt-2 pb-1 text-xs text-muted-foreground">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span
            className={i.line ? 'h-0.5 w-4 rounded-full' : 'size-2.5 rounded-sm'}
            style={{ background: i.color }}
          />
          {i.label}
        </span>
      ))}
    </div>
  );
}
