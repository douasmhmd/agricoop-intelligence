import {
  Button,
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
import { stagger } from '@agricoop/ui/motion';
import { Link } from '@tanstack/react-router';
import { QrCode } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAnalyticsAlertesQr } from '@/api/generated/analytics/analytics';
import { AnalyticsAlertesQrNiveau } from '@/api/generated/model';
import { ok } from '@/api/ok';
import { DateText, ErrorAlert, Loading, StatusBadge } from '@/components/common';
import { qrNiveauKey } from './insights';
import { qrNiveauTone } from '@/lib/tones';
import { Section, SectionEmpty, TableScroll } from './parts';

type Filter = 'tous' | AnalyticsAlertesQrNiveau;

export function QrTab() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<Filter>('tous');
  const query = useAnalyticsAlertesQr(filter === 'tous' ? undefined : { niveau: filter });
  const rows = ok(query.data) ?? [];
  const num = (n: number, digits = 0) =>
    n.toLocaleString('fr-FR', { maximumFractionDigits: digits });

  return (
    <motion.div variants={stagger(0.05)} initial="hidden" animate="visible" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList>
            <TabsTrigger value="tous">{t('analyses.qr.tous')}</TabsTrigger>
            {Object.values(AnalyticsAlertesQrNiveau).map((n) => (
              <TabsTrigger key={n} value={n}>
                {t(`analyses.qr.niveaux.${qrNiveauKey(n)}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Button asChild variant="outline" size="sm">
          <Link to="/qr">
            <QrCode /> {t('analyses.qr.open')}
          </Link>
        </Button>
      </div>

      <Section
        title={t('analyses.qr.title')}
        description={t('analyses.qr.hint')}
        aside={
          query.isSuccess && (
            <span className="text-sm text-muted-foreground">
              {t('analyses.qr.count', { count: rows.length })}
            </span>
          )
        }
      >
        {query.isPending ? (
          <div className="px-5">
            <Loading />
          </div>
        ) : query.error ? (
          <div className="p-5">
            <ErrorAlert error={query.error} />
          </div>
        ) : rows.length === 0 ? (
          <SectionEmpty>{t('analyses.qr.none')}</SectionEmpty>
        ) : (
          <TableScroll>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="ps-5">{t('analyses.qr.niveau')}</TableHead>
                  <TableHead>{t('analyses.qr.qr')}</TableHead>
                  <TableHead className="text-end">{t('analyses.qr.scans')}</TableHead>
                  <TableHead className="text-end">{t('analyses.qr.villes')}</TableHead>
                  <TableHead className="text-end">{t('analyses.qr.distance')}</TableHead>
                  <TableHead className="text-end">{t('analyses.qr.duree')}</TableHead>
                  <TableHead className="pe-5">{t('analyses.qr.date')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((a) => (
                  <TableRow key={a.qr_id}>
                    <TableCell className="ps-5">
                      <StatusBadge tone={qrNiveauTone[qrNiveauKey(a.niveau)]}>
                        {t(`analyses.qr.niveaux.${qrNiveauKey(a.niveau)}`)}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="font-mono text-xs" title={a.qr_id}>
                      {a.qr_id.slice(0, 8)}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">{num(a.nb_scans)}</TableCell>
                    <TableCell className="text-end tabular-nums">{num(a.nb_villes)}</TableCell>
                    <TableCell className="text-end whitespace-nowrap tabular-nums">
                      {t('analyses.qr.km', { value: num(a.distance_max_km) })}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">{num(a.duree_jours, 1)}</TableCell>
                    <TableCell className="pe-5">
                      <DateText value={a.date_analyse} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableScroll>
        )}
      </Section>
    </motion.div>
  );
}
