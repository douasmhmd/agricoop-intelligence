import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStockAlertes } from '@/api/generated/stock/stock';
import { ok } from '@/api/ok';
import {
  DateText,
  EmptyState,
  ErrorAlert,
  Loading,
  PageHeader,
  StatusBadge,
  SyntheticBadge,
} from '@/components/common';
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
import { alerteTone } from '@/lib/tones';
import { usePreferences } from '@/state/preferences';

export const Route = createFileRoute('/stock/alertes')({
  component: AlertesPage,
});

function AlertesPage() {
  const { t } = useTranslation();
  const { synthetic } = usePreferences();
  const [jours, setJours] = useState<'30' | '60' | '90'>('30');
  const query = useStockAlertes({ jours, synthetic });
  const rows = ok(query.data) ?? [];

  return (
    <>
      <PageHeader title={t('alertes.title')} description={t('alertes.subtitle')} />
      <Tabs value={jours} onValueChange={(v) => setJours(v as typeof jours)} className="mb-4">
        <TabsList>
          {(['30', '60', '90'] as const).map((j) => (
            <TabsTrigger key={j} value={j}>
              {t('alertes.within', { jours: j })}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorAlert error={query.error} />
      ) : rows.length === 0 ? (
        <EmptyState>{t('alertes.none')}</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('alertes.niveauLabel')}</TableHead>
                <TableHead>{t('lots.numero')}</TableHead>
                <TableHead>{t('lots.produit')}</TableHead>
                <TableHead>{t('lots.peremption')}</TableHead>
                <TableHead className="text-end">{t('alertes.joursRestants')}</TableHead>
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
                    <Link
                      to="/lots/$lotId"
                      params={{ lotId: a.lot_id }}
                      className="hover:underline"
                    >
                      {a.numero}
                    </Link>{' '}
                    <SyntheticBadge show={a.is_synthetic} />
                  </TableCell>
                  <TableCell>{a.produit_nom}</TableCell>
                  <TableCell>
                    <DateText value={a.date_peremption} />
                  </TableCell>
                  <TableCell className="text-end tabular-nums">{a.jours_restants}</TableCell>
                  <TableCell className="text-end font-medium tabular-nums">{a.stock}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
