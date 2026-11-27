import { QR_STATUTS, type QrCode, type QrStatut } from '@agricoop/shared';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { fadeUpSmall, stagger } from '@agricoop/ui/motion';
import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Ban, Flag, History, MapPin, QrCode as QrIcon, RotateCcw, Smartphone } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  useQrAdminChangeStatut,
  useQrAdminList,
  useQrAdminScans,
  useQrAdminVilles,
} from '@/api/generated/qr-codes/qr-codes';
import { ok } from '@/api/ok';
import {
  DateText,
  EmptyState,
  ErrorAlert,
  PageHeader,
  Pagination,
  StatusBadge,
  SyntheticBadge,
  useErrorMessage,
} from '@/components/common';
import { DataCard, FilterBar, FilterChip, RowActions, TableSkeleton } from '@/components/data';
import { BarList, ChartEmpty, ChartSkeleton } from '@/dashboard/charts';
import { qrAlerteTone, qrTone } from '@/lib/tones';

export const Route = createFileRoute('/qr')({
  component: QrPage,
});

const PAGE_SIZE = 25;
const STATUT_ICON = { actif: RotateCcw, desactive: Ban, signale: Flag } as const;

function QrPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const [statut, setStatut] = useState<QrStatut | ''>('');
  const [page, setPage] = useState(1);
  const [history, setHistory] = useState<QrCode | null>(null);
  const list = useQrAdminList({ page, pageSize: PAGE_SIZE, ...(statut ? { statut } : {}) });
  const change = useQrAdminChangeStatut();
  const data = ok(list.data);

  const setQrStatut = (qr: QrCode, s: QrStatut) =>
    change.mutate(
      { qrId: qr.qr_id, data: { statut: s } },
      {
        onSuccess: () => {
          toast.success(t('qr.updated'));
          void queryClient.invalidateQueries();
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );

  return (
    <>
      <PageHeader title={t('qr.title')} description={t('qr.subtitle')} />
      {/* Side chart only on very wide screens: the table needs the width. */}
      <div className="grid gap-6 2xl:grid-cols-3">
        <div className="min-w-0 2xl:col-span-2">
          <FilterBar
            active={Boolean(statut)}
            onReset={() => {
              setStatut('');
              setPage(1);
            }}
          >
            <FilterChip
              label={t('qr.statut')}
              value={statut}
              onChange={(v) => {
                setStatut(v);
                setPage(1);
              }}
              options={QR_STATUTS.map((s) => ({ value: s, label: t(`qrStatut.${s}`) }))}
            />
          </FilterBar>
          {list.isPending ? (
            <TableSkeleton columns={6} />
          ) : list.error ? (
            <ErrorAlert error={list.error} />
          ) : !data || data.items.length === 0 ? (
            <EmptyState icon={QrIcon} title={statut ? t('common.noMatch') : t('qr.emptyTitle')}>
              {statut ? t('common.noMatchHint') : t('qr.empty')}
            </EmptyState>
          ) : (
            <>
              <DataCard>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('lots.lot')}</TableHead>
                      <TableHead>{t('qr.statut')}</TableHead>
                      <TableHead className="text-end">{t('qr.scans')}</TableHead>
                      <TableHead className="text-end max-md:hidden">{t('qr.villes')}</TableHead>
                      <TableHead className="max-md:hidden">{t('qr.dernierScan')}</TableHead>
                      <TableHead>{t('qr.alertes')}</TableHead>
                      <TableHead>
                        <span className="sr-only">{t('common.actions')}</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.items.map((q) => {
                      const name =
                        q.numero_serie === null
                          ? q.lot_numero
                          : `${q.lot_numero} · ${q.numero_serie}`;
                      return (
                        <TableRow key={q.qr_id}>
                          <TableCell className="font-mono text-xs">
                            <span className="flex items-center gap-2">
                              <Link
                                to="/lots/$lotId"
                                params={{ lotId: q.lot_id }}
                                className="font-medium text-foreground hover:text-primary hover:underline"
                              >
                                {q.lot_numero}
                              </Link>
                              <SyntheticBadge show={q.is_synthetic} />
                            </span>
                            <span className="font-sans text-muted-foreground">
                              {q.numero_serie === null
                                ? t('niveauQr.lot')
                                : `${t('qr.serie')} ${q.numero_serie}`}
                            </span>
                          </TableCell>
                          <TableCell>
                            <StatusBadge tone={qrTone[q.statut]}>
                              {t(`qrStatut.${q.statut}`)}
                            </StatusBadge>
                          </TableCell>
                          <TableCell className="text-end font-medium tabular-nums">
                            {q.nb_scans}
                          </TableCell>
                          <TableCell className="text-end tabular-nums max-md:hidden">
                            {q.nb_villes}
                          </TableCell>
                          <TableCell className="text-muted-foreground max-md:hidden">
                            <DateText value={q.dernier_scan} withTime />
                          </TableCell>
                          <TableCell>
                            <span className="flex flex-wrap gap-1">
                              {q.alertes.length === 0 ? (
                                <span className="text-muted-foreground">—</span>
                              ) : (
                                q.alertes.map((a) => (
                                  <StatusBadge key={a} tone={qrAlerteTone[a]}>
                                    {t(`qrAlerte.${a}`)}
                                  </StatusBadge>
                                ))
                              )}
                            </span>
                          </TableCell>
                          <TableCell className="text-end">
                            <RowActions label={name}>
                              <DropdownMenuItem onSelect={() => setHistory(q)}>
                                <History /> {t('qr.history')}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {QR_STATUTS.filter((s) => s !== q.statut).map((s) => {
                                const Icon = STATUT_ICON[s];
                                return (
                                  <DropdownMenuItem
                                    key={s}
                                    variant={s === 'actif' ? 'default' : 'destructive'}
                                    onSelect={() => setQrStatut(q, s)}
                                  >
                                    <Icon /> {t(`qr.action.${s}`)}
                                  </DropdownMenuItem>
                                );
                              })}
                            </RowActions>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </DataCard>
              <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPage={setPage} />
            </>
          )}
        </div>
        <ScansParVille />
      </div>
      {history && <ScanHistory qr={history} onClose={() => setHistory(null)} />}
    </>
  );
}

const PERIODES = ['7', '30', '90', '365'] as const;

function ScansParVille() {
  const { t } = useTranslation();
  const [jours, setJours] = useState<(typeof PERIODES)[number]>('30');
  const query = useQrAdminVilles({ jours: Number(jours) });
  const rows = ok(query.data) ?? [];
  return (
    <Card className="h-fit gap-4 py-5">
      <CardHeader className="gap-3 px-5">
        <div className="grid gap-1">
          <CardTitle className="text-base">{t('qr.parVille')}</CardTitle>
          <CardDescription>{t('qr.parVilleHint')}</CardDescription>
        </div>
        <Tabs value={jours} onValueChange={(v) => setJours(v as typeof jours)}>
          <TabsList aria-label={t('qr.periode')}>
            {PERIODES.map((j) => (
              <TabsTrigger key={j} value={j}>
                {t('qr.daysShort', { jours: j })}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </CardHeader>
      <div className="px-3">
        {query.isPending ? (
          <ChartSkeleton />
        ) : rows.length === 0 ? (
          <ChartEmpty>{t('qr.noScans')}</ChartEmpty>
        ) : (
          <BarList
            data={rows.map((r) => ({ label: r.ville, value: r.nb_scans }))}
            valueName={t('qr.scans')}
          />
        )}
      </div>
    </Card>
  );
}

function ScanHistory({ qr, onClose }: { qr: QrCode; onClose: () => void }) {
  const { t } = useTranslation();
  const query = useQrAdminScans(qr.qr_id);
  const scans = ok(query.data) ?? [];
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('qr.history')}</DialogTitle>
          <DialogDescription>
            {qr.lot_numero}
            {qr.numero_serie !== null ? ` · ${t('qr.serie')} ${qr.numero_serie}` : ''} ·{' '}
            {t('qr.scansCount', { count: qr.nb_scans })}
          </DialogDescription>
        </DialogHeader>
        {query.isPending ? (
          <div className="grid gap-3">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : query.error ? (
          <ErrorAlert error={query.error} />
        ) : scans.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t('qr.noScans')}</p>
        ) : (
          <motion.ol
            variants={stagger(0.04)}
            initial="hidden"
            animate="visible"
            className="relative grid max-h-96 gap-1 overflow-y-auto ps-6 before:absolute before:inset-y-2 before:start-2.5 before:w-px before:bg-border"
          >
            {scans.map((s) => (
              <motion.li
                key={s.scan_id}
                variants={fadeUpSmall}
                className="relative rounded-lg px-3 py-2 text-sm hover:bg-muted/50"
              >
                <span
                  aria-hidden
                  className="absolute -start-[1.125rem] top-3.5 size-2 rounded-full bg-primary ring-4 ring-background"
                />
                <span className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 font-medium">
                    <MapPin className="size-3.5 text-muted-foreground" aria-hidden />
                    {s.ville ?? t('qr.villeInconnue')}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    <DateText value={s.date_scan} withTime />
                  </span>
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Smartphone className="size-3" aria-hidden /> {s.appareil}
                </span>
              </motion.li>
            ))}
          </motion.ol>
        )}
      </DialogContent>
    </Dialog>
  );
}
