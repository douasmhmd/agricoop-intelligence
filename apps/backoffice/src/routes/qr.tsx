import { QR_STATUTS, type QrCode, type QrStatut } from '@agricoop/shared';
import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { MoreHorizontal } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
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
  Loading,
  NativeSelect,
  PageHeader,
  Pagination,
  StatusBadge,
  SyntheticBadge,
  useErrorMessage,
  useLocale,
} from '@/components/common';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { qrAlerteTone, qrTone } from '@/lib/tones';

export const Route = createFileRoute('/qr')({
  component: QrPage,
});

const PAGE_SIZE = 25;

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
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <div className="mb-4">
            <NativeSelect
              value={statut}
              onChange={(e) => {
                setStatut(e.target.value as typeof statut);
                setPage(1);
              }}
              aria-label={t('qr.statut')}
            >
              <option value="">{t('qr.allStatuts')}</option>
              {QR_STATUTS.map((s) => (
                <option key={s} value={s}>
                  {t(`qrStatut.${s}`)}
                </option>
              ))}
            </NativeSelect>
          </div>
          {list.isPending ? (
            <Loading />
          ) : list.error ? (
            <ErrorAlert error={list.error} />
          ) : !data || data.items.length === 0 ? (
            <EmptyState>{t('qr.empty')}</EmptyState>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('lots.lot')}</TableHead>
                      <TableHead>{t('qr.serie')}</TableHead>
                      <TableHead>{t('qr.statut')}</TableHead>
                      <TableHead className="text-end">{t('qr.scans')}</TableHead>
                      <TableHead className="text-end">{t('qr.villes')}</TableHead>
                      <TableHead>{t('qr.dernierScan')}</TableHead>
                      <TableHead>{t('qr.alertes')}</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.items.map((q) => (
                      <TableRow key={q.qr_id}>
                        <TableCell className="font-mono text-xs">
                          <Link
                            to="/lots/$lotId"
                            params={{ lotId: q.lot_id }}
                            className="hover:underline"
                          >
                            {q.lot_numero}
                          </Link>{' '}
                          <SyntheticBadge show={q.is_synthetic} />
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {q.numero_serie ?? t('niveauQr.lot')}
                        </TableCell>
                        <TableCell>
                          <StatusBadge tone={qrTone[q.statut]}>
                            {t(`qrStatut.${q.statut}`)}
                          </StatusBadge>
                        </TableCell>
                        <TableCell className="text-end tabular-nums">{q.nb_scans}</TableCell>
                        <TableCell className="text-end tabular-nums">{q.nb_villes}</TableCell>
                        <TableCell>
                          <DateText value={q.dernier_scan} withTime />
                        </TableCell>
                        <TableCell className="space-x-1 rtl:space-x-reverse">
                          {q.alertes.map((a) => (
                            <StatusBadge key={a} tone={qrAlerteTone[a]}>
                              {t(`qrAlerte.${a}`)}
                            </StatusBadge>
                          ))}
                        </TableCell>
                        <TableCell className="text-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label={t('common.actions')}>
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => setHistory(q)}>
                                {t('qr.history')}
                              </DropdownMenuItem>
                              {QR_STATUTS.filter((s) => s !== q.statut).map((s) => (
                                <DropdownMenuItem key={s} onSelect={() => setQrStatut(q, s)}>
                                  {t(`qr.action.${s}`)}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
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

function ScansParVille() {
  const { t } = useTranslation();
  const locale = useLocale();
  const [jours, setJours] = useState(30);
  const query = useQrAdminVilles({ jours });
  const rows = ok(query.data) ?? [];
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>{t('qr.parVille')}</CardTitle>
        <NativeSelect
          value={jours}
          onChange={(e) => setJours(Number(e.target.value))}
          aria-label={t('qr.periode')}
        >
          {[7, 30, 90, 365].map((j) => (
            <option key={j} value={j}>
              {t('qr.lastDays', { jours: j })}
            </option>
          ))}
        </NativeSelect>
      </CardHeader>
      <CardContent>
        {query.isPending ? (
          <Loading />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('qr.noScans')}</p>
        ) : (
          <div style={{ height: Math.max(160, rows.length * 32) }} dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="ville" width={90} reversed={locale === 'ar'} />
                <Tooltip />
                <Bar dataKey="nb_scans" name={t('qr.scans')} fill="var(--chart-1)" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
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
          <DialogTitle>
            {t('qr.history')} — {qr.lot_numero}
            {qr.numero_serie !== null ? ` · ${t('qr.serie')} ${qr.numero_serie}` : ''}
          </DialogTitle>
        </DialogHeader>
        {query.isPending ? (
          <Loading />
        ) : query.error ? (
          <ErrorAlert error={query.error} />
        ) : scans.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('qr.noScans')}</p>
        ) : (
          <ul className="grid max-h-96 gap-2 overflow-y-auto text-sm">
            {scans.map((s) => (
              <li key={s.scan_id} className="flex justify-between gap-2 border-b pb-1">
                <DateText value={s.date_scan} withTime />
                <span>{s.ville ?? t('qr.villeInconnue')}</span>
                <span className="text-muted-foreground">{s.appareil}</span>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
