import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@agricoop/ui';
import { stagger } from '@agricoop/ui/motion';
import {
  CircleDollarSign,
  Percent,
  ShoppingBasket,
  ShoppingCart,
  TrendingUp,
  UserPlus,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAnalyticsKpiMensuels } from '@/api/generated/analytics/analytics';
import { ok } from '@/api/ok';
import { ErrorAlert, Loading, NativeSelect, useLocale } from '@/components/common';
import { ChartEmpty } from '@/dashboard/charts';
import { ChartLegend, MonthlyChart } from './charts';
import {
  campaignOf,
  campaigns,
  campaignTotals,
  formatAmount,
  formatPercent,
  monthLabel,
} from './insights';
import { Section, StatCard, TableScroll } from './parts';

export function VentesTab() {
  const { t } = useTranslation();
  const locale = useLocale();
  const query = useAnalyticsKpiMensuels();
  const all = useMemo(() => ok(query.data) ?? [], [query.data]);
  const list = useMemo(() => campaigns(all), [all]);
  const [selected, setSelected] = useState<string>();
  const campagne = selected && list.includes(selected) ? selected : list[0];
  const months = useMemo(
    () =>
      all
        .filter((k) => campaignOf(k.mois) === campagne)
        .sort((a, b) => a.mois.localeCompare(b.mois)),
    [all, campagne],
  );
  const totals = useMemo(() => campaignTotals(months), [months]);

  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorAlert error={query.error} />;
  if (!campagne) return <ChartEmpty>{t('analyses.empty')}</ChartEmpty>;

  const count = (n: number) => n.toLocaleString('fr-FR');

  return (
    <motion.div variants={stagger(0.05)} initial="hidden" animate="visible" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="font-medium">{t('analyses.ventes.campagne')}</span>
          <NativeSelect value={campagne} onChange={(e) => setSelected(e.target.value)}>
            {list.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </NativeSelect>
        </label>
        <p className="text-xs text-muted-foreground">
          {t('analyses.ventes.period', { count: totals.mois })}
        </p>
      </div>

      <motion.div variants={stagger(0.05)} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label={t('analyses.ventes.ca')}
          icon={CircleDollarSign}
          value={formatAmount(totals.ca, locale)}
        />
        <StatCard
          label={t('analyses.ventes.marge')}
          icon={TrendingUp}
          value={formatAmount(totals.marge, locale)}
          tone={totals.marge < 0 ? 'danger' : 'default'}
        />
        <StatCard
          label={t('analyses.ventes.tauxMarge')}
          icon={Percent}
          value={formatPercent(totals.tauxMarge, locale)}
        />
        <StatCard
          label={t('analyses.ventes.commandes')}
          icon={ShoppingCart}
          value={count(totals.commandes)}
        />
        <StatCard
          label={t('analyses.ventes.panierMoyen')}
          icon={ShoppingBasket}
          value={totals.panierMoyen === null ? '—' : formatAmount(totals.panierMoyen, locale)}
        />
        <StatCard
          label={t('analyses.ventes.nouveauxClients')}
          icon={UserPlus}
          value={count(totals.nouveauxClients)}
        />
      </motion.div>

      <Section title={t('analyses.ventes.chart')} description={t('analyses.ventes.chartHint')}>
        <div className="px-3 pt-4 pb-3">
          <MonthlyChart
            locale={locale}
            data={months.map((m) => ({
              mois: m.mois,
              ca: m.ca_mad,
              marge: m.marge_mad,
              commandes: m.commandes,
            }))}
          />
          <ChartLegend
            items={[
              { label: t('analyses.ventes.ca'), color: 'var(--chart-1)' },
              { label: t('analyses.ventes.marge'), color: 'var(--chart-3)' },
              { label: t('analyses.ventes.commandes'), color: 'var(--chart-2)', line: true },
            ]}
          />
        </div>
      </Section>

      <Section title={t('analyses.ventes.detail')}>
        <TableScroll>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="ps-5">{t('analyses.ventes.mois')}</TableHead>
                <TableHead className="text-end">{t('analyses.ventes.commandes')}</TableHead>
                <TableHead className="text-end">{t('analyses.ventes.ca')}</TableHead>
                <TableHead className="text-end">{t('analyses.ventes.marge')}</TableHead>
                <TableHead className="text-end">{t('analyses.ventes.tauxMarge')}</TableHead>
                <TableHead className="text-end">{t('analyses.ventes.panierMoyen')}</TableHead>
                <TableHead className="text-end">{t('analyses.ventes.clientsActifs')}</TableHead>
                <TableHead className="pe-5 text-end">
                  {t('analyses.ventes.nouveauxClients')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {months.map((m) => (
                <TableRow key={m.mois}>
                  <TableCell className="ps-5 font-medium capitalize">
                    {monthLabel(m.mois, locale)}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">{count(m.commandes)}</TableCell>
                  <TableCell className="text-end whitespace-nowrap tabular-nums">
                    {formatAmount(m.ca_mad, locale)}
                  </TableCell>
                  <TableCell className="text-end whitespace-nowrap tabular-nums">
                    {formatAmount(m.marge_mad, locale)}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {formatPercent(m.taux_marge, locale)}
                  </TableCell>
                  <TableCell className="text-end whitespace-nowrap tabular-nums">
                    {formatAmount(m.panier_moyen_mad, locale)}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">{count(m.clients_actifs)}</TableCell>
                  <TableCell className="pe-5 text-end tabular-nums">
                    {count(m.nouveaux_clients)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="ps-5 font-semibold">{t('analyses.total')}</TableCell>
                <TableCell className="text-end font-semibold tabular-nums">
                  {count(totals.commandes)}
                </TableCell>
                <TableCell className="text-end font-semibold whitespace-nowrap tabular-nums">
                  {formatAmount(totals.ca, locale)}
                </TableCell>
                <TableCell className="text-end font-semibold whitespace-nowrap tabular-nums">
                  {formatAmount(totals.marge, locale)}
                </TableCell>
                <TableCell className="text-end font-semibold tabular-nums">
                  {formatPercent(totals.tauxMarge, locale)}
                </TableCell>
                <TableCell className="text-end font-semibold whitespace-nowrap tabular-nums">
                  {totals.panierMoyen === null ? '—' : formatAmount(totals.panierMoyen, locale)}
                </TableCell>
                <TableCell className="text-end text-muted-foreground">—</TableCell>
                <TableCell className="pe-5 text-end font-semibold tabular-nums">
                  {count(totals.nouveauxClients)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </TableScroll>
      </Section>
    </motion.div>
  );
}
