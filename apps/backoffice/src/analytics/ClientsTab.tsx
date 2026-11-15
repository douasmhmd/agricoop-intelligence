import type { SEGMENTS } from '@agricoop/shared';
import {
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@agricoop/ui';
import { stagger } from '@agricoop/ui/motion';
import { ShieldCheck, Users } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useAnalyticsClientsDuSegment,
  useAnalyticsSegments,
} from '@/api/generated/analytics/analytics';
import { ok } from '@/api/ok';
import { ErrorAlert, Loading, useLocale } from '@/components/common';
import { ChartEmpty } from '@/dashboard/charts';
import { ChartLegend, SegmentChart } from './charts';
import {
  formatAmount,
  formatPercent,
  inContractOrder,
  segmentKey,
  segmentRevenue,
} from './insights';
import { Section, SectionEmpty, TableScroll } from './parts';

type SegmentName = (typeof SEGMENTS)[number];

/** Rows shown in the segment sheet (largest spenders first). */
const SHEET_ROWS = 200;

function useSegmentLabel() {
  const { t } = useTranslation();
  return (segment: string) => {
    const key = segmentKey(segment);
    return key ? t(`analyses.segments.${key}`) : segment;
  };
}

export function ClientsTab() {
  const { t } = useTranslation();
  const locale = useLocale();
  const label = useSegmentLabel();
  const query = useAnalyticsSegments();
  const segments = useMemo(() => inContractOrder(ok(query.data) ?? []), [query.data]);
  const [open, setOpen] = useState<SegmentName>();
  const total = segments.reduce((n, s) => n + s.clients, 0);

  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorAlert error={query.error} />;
  if (segments.length === 0) return <ChartEmpty>{t('analyses.empty')}</ChartEmpty>;

  return (
    <motion.div variants={stagger(0.05)} initial="hidden" animate="visible" className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-5">
        <Section
          title={t('analyses.clients.chart')}
          description={t('analyses.clients.chartHint')}
          className="xl:col-span-3"
        >
          <div className="px-3 pt-4 pb-3">
            <SegmentChart
              data={segments.map((s) => ({
                label: label(s.segment),
                clients: Math.round(s.part_clients * 1000) / 10,
                ca: Math.round(s.part_ca * 1000) / 10,
              }))}
            />
            <ChartLegend
              items={[
                { label: t('analyses.clients.partClients'), color: 'var(--chart-1)' },
                { label: t('analyses.clients.partCa'), color: 'var(--chart-2)' },
              ]}
            />
          </div>
        </Section>

        <Section
          title={t('analyses.clients.title')}
          description={t('analyses.clients.hint', { count: total })}
          className="xl:col-span-2"
        >
          <TableScroll>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="ps-5">{t('analyses.clients.segment')}</TableHead>
                  <TableHead className="text-end">{t('analyses.clients.clients')}</TableHead>
                  <TableHead className="text-end">{t('analyses.clients.partCa')}</TableHead>
                  <TableHead className="pe-5">
                    <span className="sr-only">{t('common.actions')}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {segments.map((s) => (
                  <TableRow key={s.segment}>
                    <TableCell className="ps-5 font-medium">{label(s.segment)}</TableCell>
                    <TableCell className="text-end tabular-nums">
                      {s.clients.toLocaleString('fr-FR')}
                      <span className="ms-1 text-xs text-muted-foreground">
                        ({formatPercent(s.part_clients, locale)})
                      </span>
                    </TableCell>
                    <TableCell className="text-end font-medium tabular-nums">
                      {formatPercent(s.part_ca, locale)}
                    </TableCell>
                    <TableCell className="pe-5 text-end">
                      {segmentKey(s.segment) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setOpen(s.segment as SegmentName)}
                        >
                          <Users /> {t('analyses.clients.voir')}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableScroll>
        </Section>
      </div>

      <SegmentSheet segment={open} onClose={() => setOpen(undefined)} />
    </motion.div>
  );
}

function SegmentSheet({ segment, onClose }: { segment?: SegmentName; onClose: () => void }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const label = useSegmentLabel();
  // The hook needs a segment even when the sheet is closed: the query stays disabled then.
  const query = useAnalyticsClientsDuSegment(segment ?? 'Revendeurs', {
    query: { enabled: segment !== undefined },
  });
  const clients = useMemo(
    () => [...(ok(query.data) ?? [])].sort((a, b) => b.montant_mad - a.montant_mad),
    [query.data],
  );

  return (
    <Sheet open={segment !== undefined} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 sm:max-w-lg">
        <SheetHeader className="border-b">
          <SheetTitle>{segment ? label(segment) : ''}</SheetTitle>
          <SheetDescription className="flex items-start gap-1.5">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t('analyses.clients.privacy')}
          </SheetDescription>
          {query.isSuccess && clients.length > 0 && (
            <p className="text-sm">
              {t('analyses.clients.sheetSummary', { count: clients.length })} ·{' '}
              <span className="font-semibold tabular-nums">
                {formatAmount(segmentRevenue(clients), locale)}
              </span>
            </p>
          )}
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {query.isPending && segment ? (
            <div className="px-5">
              <Loading />
            </div>
          ) : query.error ? (
            <div className="p-5">
              <ErrorAlert error={query.error} />
            </div>
          ) : clients.length === 0 ? (
            <SectionEmpty>{t('analyses.empty')}</SectionEmpty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="ps-5">{t('analyses.clients.client')}</TableHead>
                  <TableHead className="text-end">{t('analyses.clients.recence')}</TableHead>
                  <TableHead className="text-end">{t('analyses.clients.frequence')}</TableHead>
                  <TableHead className="pe-5 text-end">{t('analyses.clients.montant')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.slice(0, SHEET_ROWS).map((c) => (
                  <TableRow key={c.client_id}>
                    <TableCell className="ps-5 font-mono text-xs" title={c.client_id}>
                      {c.client_id.slice(0, 8)}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">{c.recence_j}</TableCell>
                    <TableCell className="text-end tabular-nums">{c.frequence}</TableCell>
                    <TableCell className="pe-5 text-end whitespace-nowrap tabular-nums">
                      {formatAmount(c.montant_mad, locale)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {clients.length > SHEET_ROWS && (
            <p className="px-5 py-3 text-xs text-muted-foreground">
              {t('analyses.clients.truncated', { count: SHEET_ROWS })}
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
