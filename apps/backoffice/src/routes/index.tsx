import { createFileRoute, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useCommandesList } from '@/api/generated/commandes/commandes';
import { useStockAlertes } from '@/api/generated/stock/stock';
import { ok } from '@/api/ok';
import {
  DateText,
  ErrorAlert,
  Loading,
  Money,
  PageHeader,
  StatusBadge,
  SyntheticBadge,
} from '@/components/common';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { alerteTone, commandeTone } from '@/lib/tones';
import { usePreferences } from '@/state/preferences';

export const Route = createFileRoute('/')({
  component: Dashboard,
});

function Kpi({
  label,
  value,
  to,
  tone,
}: {
  label: string;
  value: number | undefined;
  to: string;
  tone?: string;
}) {
  return (
    <Link to={to} className="block">
      <Card className="transition-colors hover:bg-accent/40">
        <CardHeader className="pb-1">
          <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className={`text-3xl font-semibold tabular-nums ${tone ?? ''}`}>{value ?? '—'}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

function Dashboard() {
  const { t } = useTranslation();
  const { synthetic } = usePreferences();
  const alertes = useStockAlertes({ jours: '30', synthetic });
  const aExpedier = useCommandesList({ statut: 'payee', pageSize: 1, synthetic });
  const aPayer = useCommandesList({ statut: 'creee', pageSize: 1, synthetic });
  const recentes = useCommandesList({ pageSize: 8, synthetic });

  const alertRows = ok(alertes.data) ?? [];
  const recent = ok(recentes.data);

  return (
    <>
      <PageHeader title={t('dashboard.title')} description={t('dashboard.subtitle')} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label={t('dashboard.toShip')} value={ok(aExpedier.data)?.total} to="/commandes" />
        <Kpi label={t('dashboard.toPay')} value={ok(aPayer.data)?.total} to="/commandes" />
        <Kpi
          label={t('dashboard.expired')}
          value={
            alertes.isSuccess ? alertRows.filter((a) => a.niveau === 'perime').length : undefined
          }
          to="/stock/alertes"
          tone="text-red-700"
        />
        <Kpi
          label={t('dashboard.expiring30')}
          value={alertes.isSuccess ? alertRows.filter((a) => a.niveau === 'j30').length : undefined}
          to="/stock/alertes"
          tone="text-amber-700"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.recentOrders')}</CardTitle>
          </CardHeader>
          <CardContent>
            {recentes.isPending ? (
              <Loading />
            ) : recentes.error ? (
              <ErrorAlert error={recentes.error} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('commandes.date')}</TableHead>
                    <TableHead>{t('commandes.ville')}</TableHead>
                    <TableHead>{t('commandes.statut')}</TableHead>
                    <TableHead className="text-end">{t('commandes.montant')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent?.items.map((c) => (
                    <TableRow key={c.commande_id}>
                      <TableCell>
                        <Link
                          to="/commandes/$commandeId"
                          params={{ commandeId: c.commande_id }}
                          className="hover:underline"
                        >
                          <DateText value={c.date_commande} />
                        </Link>{' '}
                        <SyntheticBadge show={c.is_synthetic} />
                      </TableCell>
                      <TableCell>{c.ville}</TableCell>
                      <TableCell>
                        <StatusBadge tone={commandeTone[c.statut]}>
                          {t(`statut.${c.statut}`)}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="text-end">
                        <Money value={c.montant_total_mad} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.expiryAlerts')}</CardTitle>
          </CardHeader>
          <CardContent>
            {alertes.isPending ? (
              <Loading />
            ) : alertes.error ? (
              <ErrorAlert error={alertes.error} />
            ) : alertRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('alertes.none')}</p>
            ) : (
              <ul className="grid gap-2">
                {alertRows.slice(0, 8).map((a) => (
                  <li key={a.lot_id} className="flex items-center justify-between gap-2 text-sm">
                    <Link
                      to="/lots/$lotId"
                      params={{ lotId: a.lot_id }}
                      className="truncate hover:underline"
                    >
                      {a.produit_code} · {a.numero}
                    </Link>
                    <span className="flex items-center gap-2">
                      <span className="tabular-nums text-muted-foreground">{a.stock}</span>
                      <StatusBadge tone={alerteTone[a.niveau]}>
                        {t(`alertes.niveau.${a.niveau}`)}
                      </StatusBadge>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
