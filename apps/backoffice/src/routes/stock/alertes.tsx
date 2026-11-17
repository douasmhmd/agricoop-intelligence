import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsList,
  TabsTrigger,
} from '@agricoop/ui';
import { createFileRoute, Link } from '@tanstack/react-router';
import { CalendarCheck } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStockAlertes } from '@/api/generated/stock/stock';
import { ok } from '@/api/ok';
import {
  DateText,
  EmptyState,
  ErrorAlert,
  PageHeader,
  StatusBadge,
  SyntheticBadge,
} from '@/components/common';
import { DataCard, ExpiryBar, TableSkeleton } from '@/components/data';
import { alerteTone } from '@/lib/tones';
import { usePreferences } from '@/state/preferences';

export const Route = createFileRoute('/stock/alertes')({
  component: AlertesPage,
});

const NIVEAUX = ['perime', 'j30', 'j60', 'j90'] as const;

function AlertesPage() {
  const { t } = useTranslation();
  const { synthetic } = usePreferences();
  const [jours, setJours] = useState<'30' | '60' | '90'>('30');
  const query = useStockAlertes({ jours, synthetic });
  const rows = ok(query.data) ?? [];
  const units = rows.reduce((n, a) => n + a.stock, 0);

  return (
    <>
      <PageHeader title={t('alertes.title')} description={t('alertes.subtitle')} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs value={jours} onValueChange={(v) => setJours(v as typeof jours)}>
          <TabsList>
            {(['30', '60', '90'] as const).map((j) => (
              <TabsTrigger key={j} value={j}>
                {t('alertes.within', { jours: j })}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {query.isSuccess && rows.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {NIVEAUX.map((n) => {
              const count = rows.filter((a) => a.niveau === n).length;
              return count > 0 ? (
                <StatusBadge key={n} tone={alerteTone[n]}>
                  {t(`alertes.niveau.${n}`)} · {count}
                </StatusBadge>
              ) : null;
            })}
            <span className="tabular-nums">{t('alertes.units', { count: units })}</span>
          </div>
        )}
      </div>
      {query.isPending ? (
        <TableSkeleton columns={6} />
      ) : query.error ? (
        <ErrorAlert error={query.error} />
      ) : rows.length === 0 ? (
        <EmptyState icon={CalendarCheck} title={t('alertes.noneTitle')}>
          {t('alertes.none')}
        </EmptyState>
      ) : (
        <DataCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('alertes.niveauLabel')}</TableHead>
                <TableHead>{t('lots.numero')}</TableHead>
                <TableHead>{t('lots.produit')}</TableHead>
                <TableHead>{t('lots.peremption')}</TableHead>
                <TableHead className="min-w-52">{t('alertes.joursRestants')}</TableHead>
                <TableHead className="text-end">{t('lots.stock')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((a) => (
                <TableRow key={a.lot_id}>
                  <TableCell>
                    <StatusBadge tone={alerteTone[a.niveau]}>
                      {t(`alertes.niveau.${a.niveau}`)}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    <span className="flex items-center gap-2">
                      <Link
                        to="/lots/$lotId"
                        params={{ lotId: a.lot_id }}
                        className="font-medium text-foreground hover:text-primary hover:underline"
                      >
                        {a.numero}
                      </Link>
                      <SyntheticBadge show={a.is_synthetic} />
                    </span>
                  </TableCell>
                  <TableCell>{a.produit_nom}</TableCell>
                  <TableCell className="text-muted-foreground">
                    <DateText value={a.date_peremption} />
                  </TableCell>
                  <TableCell>
                    <ExpiryBar jours={a.jours_restants} />
                  </TableCell>
                  <TableCell className="text-end font-semibold tabular-nums">{a.stock}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataCard>
      )}
    </>
  );
}
