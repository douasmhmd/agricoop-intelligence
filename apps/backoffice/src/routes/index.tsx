import { Badge, Button, Card, CardHeader, CardTitle, cn } from '@agricoop/ui';
import { stagger } from '@agricoop/ui/motion';
import { createFileRoute, Link } from '@tanstack/react-router';
import {
  ArrowRight,
  Boxes,
  CircleDollarSign,
  Package,
  Plus,
  QrCode,
  ShoppingCart,
  TriangleAlert,
  Truck,
  Wallet,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useCommandesList } from '@/api/generated/commandes/commandes';
import { usePrevisionsSeries } from '@/api/generated/previsions/previsions';
import { useQrAdminVilles } from '@/api/generated/qr-codes/qr-codes';
import { useStockAlertes } from '@/api/generated/stock/stock';
import { ok } from '@/api/ok';
import { useSession } from '@/auth/session';
import { DateText, ErrorAlert, Money, PageHeader, SyntheticBadge } from '@/components/common';
import {
  BarList,
  ChartCard,
  ChartEmpty,
  ChartSkeleton,
  SalesForecastChart,
} from '@/dashboard/charts';
import { KpiCard } from '@/dashboard/KpiCard';
import {
  deltaPct,
  forecastTotals,
  ordersWindow,
  scanSummary,
  stockSummary,
} from '@/dashboard/metrics';
import { useRecentOrders, useStockData } from '@/dashboard/useDashboard';
import { usePreferences } from '@/state/preferences';

export const Route = createFileRoute('/')({
  component: Dashboard,
});

const statutVariant = {
  creee: 'info',
  payee: 'warning',
  expediee: 'default',
  livree: 'success',
  annulee: 'secondary',
} as const;

const alerteVariant = {
  perime: 'destructive',
  j30: 'warning',
  j60: 'info',
  j90: 'secondary',
} as const;

function Dashboard() {
  const { t } = useTranslation();
  const session = useSession();
  const { synthetic } = usePreferences();

  const orders = useRecentOrders();
  const stock = useStockData();
  const alertes = useStockAlertes({ jours: '30', synthetic });
  const scans30 = useQrAdminVilles({ jours: 30 });
  const scans60 = useQrAdminVilles({ jours: 60 });
  const previsions = usePrevisionsSeries({ synthetic });
  const aExpedier = useCommandesList({ statut: 'payee', pageSize: 1, synthetic });
  const aPayer = useCommandesList({ statut: 'creee', pageSize: 1, synthetic });

  const window = useMemo(
    () =>
      orders.data
        ? ordersWindow(orders.data.items, orders.data.today, orders.data.complete)
        : undefined,
    [orders.data],
  );
  const stockSum = useMemo(
    () => (stock.data ? stockSummary(stock.data.lots, stock.data.produits) : undefined),
    [stock.data],
  );
  const scanSum = useMemo(
    () => scanSummary(ok(scans30.data) ?? [], ok(scans60.data) ?? []),
    [scans30.data, scans60.data],
  );
  const forecast = useMemo(() => forecastTotals(ok(previsions.data)), [previsions.data]);
  const alertRows = ok(alertes.data) ?? [];
  const watch = alertRows.filter((a) => a.niveau === 'perime' || a.niveau === 'j30');
  const toShip = ok(aExpedier.data)?.total ?? 0;
  const toPay = ok(aPayer.data)?.total ?? 0;
  const recent = (orders.data?.items ?? []).slice(0, 7);

  return (
    <motion.div variants={stagger(0.05)} initial="hidden" animate="visible" className="space-y-6">
      <PageHeader
        title={t('dashboard.title')}
        description={
          session?.name ? t('dashboard.hello', { name: session.name }) : t('dashboard.subtitle')
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/lots" search={{ nouveau: 1 }}>
                <Plus /> {t('lots.new')}
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/produits" search={{ nouveau: 1 }}>
                <Plus /> {t('produits.new')}
              </Link>
            </Button>
          </div>
        }
      />

      {(toShip > 0 || toPay > 0) && (
        <div className="flex flex-wrap gap-2">
          {toShip > 0 && (
            <ActionPill to="/commandes" icon={Truck} tone="warning">
              {t('dashboard.toShip')} · <strong className="tabular-nums">{toShip}</strong>
            </ActionPill>
          )}
          {toPay > 0 && (
            <ActionPill to="/commandes" icon={Wallet}>
              {t('dashboard.toPay')} · <strong className="tabular-nums">{toPay}</strong>
            </ActionPill>
          )}
        </div>
      )}

      <motion.div variants={stagger(0.06)} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <KpiCard
          label={t('dashboard.revenue')}
          className="lg:col-span-2"
          hint={t('dashboard.last30')}
          icon={CircleDollarSign}
          kind="money"
          value={window?.revenue}
          delta={window ? deltaPct(window.revenue, window.revenuePrevious) : undefined}
          deltaLabel={t('dashboard.vsPrevious')}
          spark={window?.dailyRevenue}
          footnote={
            window && !window.complete
              ? t('dashboard.partial', { count: orders.data?.items.length })
              : undefined
          }
          loading={orders.isPending}
          to="/commandes"
        />
        <KpiCard
          label={t('dashboard.orders')}
          className="lg:col-span-2"
          hint={t('dashboard.last30')}
          icon={ShoppingCart}
          value={window?.count}
          delta={window ? deltaPct(window.count, window.countPrevious) : undefined}
          deltaLabel={t('dashboard.vsPrevious')}
          spark={window?.dailyCount}
          loading={orders.isPending}
          to="/commandes"
        />
        <KpiCard
          label={t('dashboard.stockValue')}
          className="lg:col-span-2"
          hint={t('dashboard.stockValueHint')}
          icon={Boxes}
          kind="money"
          value={stockSum?.valueAtCost}
          loading={stock.isPending}
          to="/lots"
        />
        <KpiCard
          label={t('dashboard.lotsWatch')}
          className="lg:col-span-3"
          hint={t('dashboard.lotsWatchHint')}
          icon={TriangleAlert}
          value={alertes.isSuccess ? watch.length : undefined}
          tone={watch.length > 0 ? 'warning' : 'default'}
          loading={alertes.isPending}
          to="/stock/alertes"
        />
        <KpiCard
          label={t('dashboard.scans')}
          className="lg:col-span-3"
          hint={t('dashboard.last30')}
          icon={QrCode}
          value={scans30.isSuccess ? scanSum.total : undefined}
          delta={scans60.isSuccess ? deltaPct(scanSum.total, scanSum.previous) : undefined}
          deltaLabel={t('dashboard.vsPrevious')}
          loading={scans30.isPending}
          to="/qr"
        />
      </motion.div>

      {orders.error && <ErrorAlert error={orders.error} />}

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard
          title={t('dashboard.salesVsForecast')}
          description={t('dashboard.salesVsForecastHint')}
          className="lg:col-span-2"
        >
          {previsions.isPending ? (
            <ChartSkeleton />
          ) : forecast.length === 0 ? (
            <ChartEmpty>{t('dashboard.noData')}</ChartEmpty>
          ) : (
            <>
              <SalesForecastChart data={forecast} />
              <Legend withForecast={forecast.some((p) => p.prevues !== null)} />
            </>
          )}
        </ChartCard>
        <ChartCard
          title={t('dashboard.stockByFamille')}
          description={t('dashboard.stockByFamilleHint')}
        >
          {stock.isPending ? (
            <ChartSkeleton />
          ) : !stockSum || stockSum.byFamille.length === 0 ? (
            <ChartEmpty>{t('dashboard.noData')}</ChartEmpty>
          ) : (
            <BarList
              data={stockSum.byFamille.map((f) => ({
                label: t(`famille.${f.famille}`),
                value: f.units,
              }))}
              valueName={t('lots.stock')}
              colors={['var(--chart-1)', 'var(--chart-3)', 'var(--chart-2)']}
            />
          )}
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <motion.div variants={stagger(0)} className="lg:col-span-2">
          <Card className="h-full gap-0 py-0">
            <CardHeader className="flex flex-row items-center justify-between border-b px-5 py-4">
              <CardTitle className="text-base">{t('dashboard.recentOrders')}</CardTitle>
              <SeeAll to="/commandes" />
            </CardHeader>
            <ul className="divide-y">
              {orders.isPending &&
                Array.from({ length: 4 }, (_, i) => (
                  <li key={i} className="h-14 animate-pulse bg-muted/40" />
                ))}
              {!orders.isPending && recent.length === 0 && (
                <li className="px-5 py-10 text-center text-sm text-muted-foreground">
                  {t('dashboard.noData')}
                </li>
              )}
              {recent.map((c) => (
                <li key={c.commande_id}>
                  <Link
                    to="/commandes/$commandeId"
                    params={{ commandeId: c.commande_id }}
                    className="flex items-center gap-4 px-5 py-3 text-sm transition-colors hover:bg-muted/50"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-primary">
                      <Package className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 font-medium">
                        {c.ville} <SyntheticBadge show={c.is_synthetic} />
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        <DateText value={c.date_commande} withTime />
                      </span>
                    </span>
                    <Badge variant={statutVariant[c.statut]} dot className="max-sm:hidden">
                      {t(`statut.${c.statut}`)}
                    </Badge>
                    <span className="w-28 text-end font-semibold">
                      <Money value={c.montant_total_mad} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </motion.div>

        <div className="grid gap-4">
          <ChartCard title={t('dashboard.scansByCity')} description={t('dashboard.last30')}>
            {scans30.isPending ? (
              <ChartSkeleton />
            ) : scanSum.top.length === 0 ? (
              <ChartEmpty>{t('dashboard.noData')}</ChartEmpty>
            ) : (
              <BarList
                data={scanSum.top.map((v) => ({ label: v.ville, value: v.scans }))}
                valueName={t('dashboard.scans')}
              />
            )}
          </ChartCard>
          <motion.div variants={stagger(0)}>
            <Card className="gap-0 py-0">
              <CardHeader className="flex flex-row items-center justify-between border-b px-5 py-4">
                <CardTitle className="text-base">{t('dashboard.expiryAlerts')}</CardTitle>
                <SeeAll to="/stock/alertes" />
              </CardHeader>
              {alertRows.length === 0 ? (
                <p className="px-5 py-6 text-sm text-muted-foreground">{t('alertes.none')}</p>
              ) : (
                <ul className="divide-y">
                  {alertRows.slice(0, 5).map((a) => (
                    <li key={a.lot_id}>
                      <Link
                        to="/lots/$lotId"
                        params={{ lotId: a.lot_id }}
                        className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm transition-colors hover:bg-muted/50"
                      >
                        <span className="min-w-0 truncate">
                          <span className="font-medium">{a.produit_code}</span>{' '}
                          <span className="text-muted-foreground">{a.numero}</span>
                        </span>
                        <Badge variant={alerteVariant[a.niveau]} dot>
                          {t(`alertes.niveau.${a.niveau}`)}
                        </Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

function Legend({ withForecast }: { withForecast: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center gap-5 pt-2 pb-1 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-4 rounded-sm bg-chart-1/70" /> {t('dashboard.sold')}
      </span>
      {withForecast && (
        <span className="flex items-center gap-1.5">
          <span className="h-0 w-4 border-t-2 border-dashed border-chart-2" />{' '}
          {t('dashboard.forecast')}
        </span>
      )}
    </div>
  );
}

function SeeAll({ to }: { to: string }) {
  const { t } = useTranslation();
  return (
    <Link
      to={to}
      className="group inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
    >
      {t('dashboard.viewAll')}
      <ArrowRight
        className="size-3.5 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
        aria-hidden
      />
    </Link>
  );
}

function ActionPill({
  to,
  icon: Icon,
  tone = 'default',
  children,
}: {
  to: string;
  icon: typeof Truck;
  tone?: 'default' | 'warning';
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm shadow-soft transition-colors',
        tone === 'warning'
          ? 'border-warning/50 bg-warning/15 text-warning-foreground hover:bg-warning/25 dark:text-warning'
          : 'border-border bg-card hover:bg-accent',
      )}
    >
      <Icon className="size-4" aria-hidden />
      {children}
    </Link>
  );
}
