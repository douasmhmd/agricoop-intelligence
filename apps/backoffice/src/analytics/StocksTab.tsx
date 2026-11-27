import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@agricoop/ui';
import { stagger } from '@agricoop/ui/motion';
import { CircleCheck, CircleX, Gauge, TriangleAlert } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useAnalyticsAnomaliesStock,
  useAnalyticsLotsASurveiller,
  useAnalyticsRisqueInvendus,
  useAnalyticsStocks,
} from '@/api/generated/analytics/analytics';
import { ok } from '@/api/ok';
import { DateText, ErrorAlert, Loading, StatusBadge, useLocale } from '@/components/common';
import { bySeverity, dateReference, formatAmount, sumAmounts } from './insights';
import { stockTone } from '@/lib/tones';
import { DataDate, Section, SectionEmpty, StatCard, TableScroll } from './parts';

const NIVEAUX = ['rupture', 'critique', 'attention', 'ok'] as const;

export function StocksTab() {
  const { t } = useTranslation();
  const locale = useLocale();
  const stocks = useAnalyticsStocks();
  const lots = useAnalyticsLotsASurveiller();
  const risque = useAnalyticsRisqueInvendus();
  const anomalies = useAnalyticsAnomaliesStock();

  const rows = useMemo(() => bySeverity(ok(stocks.data) ?? []), [stocks.data]);
  const counts = useMemo(
    () =>
      Object.fromEntries(NIVEAUX.map((n) => [n, rows.filter((r) => r.niveau_alerte === n).length])),
    [rows],
  );
  const lotRows = ok(lots.data) ?? [];
  const risqueRows = ok(risque.data) ?? [];
  const anomalieRows = ok(anomalies.data) ?? [];
  const risqueTotal = sumAmounts(risqueRows.map((r) => r.valeur_a_risque_mad));
  const num = (n: number, digits = 0) =>
    n.toLocaleString('fr-FR', { maximumFractionDigits: digits });

  if (stocks.isPending) return <Loading />;
  if (stocks.error) return <ErrorAlert error={stocks.error} />;

  return (
    <motion.div variants={stagger(0.05)} initial="hidden" animate="visible" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t('analyses.stocks.intro')}</p>
        <DataDate value={dateReference(stocks.data)} />
      </div>

      <motion.div variants={stagger(0.05)} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label={t('analyses.stocks.niveaux.rupture')}
          icon={CircleX}
          value={counts.rupture}
          tone={counts.rupture ? 'danger' : 'default'}
        />
        <StatCard
          label={t('analyses.stocks.niveaux.critique')}
          icon={TriangleAlert}
          value={counts.critique}
          tone={counts.critique ? 'warning' : 'default'}
        />
        <StatCard
          label={t('analyses.stocks.niveaux.attention')}
          icon={Gauge}
          value={counts.attention}
        />
        <StatCard label={t('analyses.stocks.niveaux.ok')} icon={CircleCheck} value={counts.ok} />
      </motion.div>

      <Section title={t('analyses.stocks.title')} description={t('analyses.stocks.hint')}>
        {rows.length === 0 ? (
          <SectionEmpty>{t('analyses.empty')}</SectionEmpty>
        ) : (
          <TableScroll>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="ps-5">{t('analyses.stocks.niveau')}</TableHead>
                  <TableHead>{t('analyses.stocks.produit')}</TableHead>
                  <TableHead>{t('analyses.stocks.famille')}</TableHead>
                  <TableHead className="text-end">{t('analyses.stocks.disponible')}</TableHead>
                  <TableHead className="text-end">{t('analyses.stocks.venteJour')}</TableHead>
                  <TableHead className="pe-5 text-end">{t('analyses.stocks.couverture')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((s) => (
                  <TableRow key={s.produit}>
                    <TableCell className="ps-5">
                      <StatusBadge tone={stockTone[s.niveau_alerte]}>
                        {t(`analyses.stocks.niveaux.${s.niveau_alerte}`)}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="font-medium">{s.produit}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {t(`famille.${s.famille}`)}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {num(s.stock_disponible)}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {num(s.vente_moy_jour, 2)}
                    </TableCell>
                    <TableCell className="pe-5 text-end font-medium tabular-nums">
                      {s.couverture_jours === null ? '—' : num(s.couverture_jours)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableScroll>
        )}
      </Section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Section title={t('analyses.lots.title')} description={t('analyses.lots.hint')}>
          {lots.isPending ? (
            <Loading />
          ) : lots.error ? (
            <div className="p-5">
              <ErrorAlert error={lots.error} />
            </div>
          ) : lotRows.length === 0 ? (
            <SectionEmpty>{t('analyses.lots.none')}</SectionEmpty>
          ) : (
            <TableScroll>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="ps-5">{t('analyses.lots.lot')}</TableHead>
                    <TableHead>{t('analyses.stocks.produit')}</TableHead>
                    <TableHead>{t('analyses.lots.peremption')}</TableHead>
                    <TableHead className="text-end">{t('analyses.lots.jours')}</TableHead>
                    <TableHead className="pe-5 text-end">{t('analyses.lots.stock')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lotRows.map((l) => (
                    <TableRow key={l.lot}>
                      <TableCell className="ps-5 font-mono text-xs">{l.lot}</TableCell>
                      <TableCell>{l.produit}</TableCell>
                      <TableCell>
                        <DateText value={l.date_peremption} />
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        <StatusBadge tone={l.jours_avant_peremption <= 30 ? 'warning' : 'info'}>
                          {num(l.jours_avant_peremption)}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="pe-5 text-end tabular-nums">
                        {num(l.stock_actuel)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableScroll>
          )}
        </Section>

        <Section
          title={t('analyses.risque.title')}
          description={t('analyses.risque.hint')}
          aside={
            risqueRows.length > 0 && (
              <span className="text-sm font-semibold whitespace-nowrap tabular-nums">
                {formatAmount(risqueTotal, locale)}
              </span>
            )
          }
        >
          {risque.isPending ? (
            <Loading />
          ) : risque.error ? (
            <div className="p-5">
              <ErrorAlert error={risque.error} />
            </div>
          ) : risqueRows.length === 0 ? (
            <SectionEmpty>{t('analyses.risque.none')}</SectionEmpty>
          ) : (
            <TableScroll>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="ps-5">{t('analyses.lots.lot')}</TableHead>
                    <TableHead>{t('analyses.stocks.produit')}</TableHead>
                    <TableHead>{t('analyses.lots.peremption')}</TableHead>
                    <TableHead className="text-end">{t('analyses.risque.unites')}</TableHead>
                    <TableHead className="pe-5 text-end">{t('analyses.risque.valeur')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {risqueRows.map((r) => (
                    <TableRow key={r.lot}>
                      <TableCell className="ps-5 font-mono text-xs">{r.lot}</TableCell>
                      <TableCell>{r.produit}</TableCell>
                      <TableCell>
                        <DateText value={r.date_peremption} />
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {num(r.unites_a_risque)} / {num(r.stock_actuel)}
                      </TableCell>
                      <TableCell className="pe-5 text-end whitespace-nowrap tabular-nums">
                        {formatAmount(r.valeur_a_risque_mad, locale)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableScroll>
          )}
        </Section>
      </div>

      <Section title={t('analyses.anomalies.title')} description={t('analyses.anomalies.hint')}>
        {anomalies.isPending ? (
          <Loading />
        ) : anomalies.error ? (
          <div className="p-5">
            <ErrorAlert error={anomalies.error} />
          </div>
        ) : anomalieRows.length === 0 ? (
          <p className="flex items-center justify-center gap-2 px-5 py-6 text-sm text-success">
            <CircleCheck className="size-4" aria-hidden /> {t('analyses.anomalies.none')}
          </p>
        ) : (
          <TableScroll>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="ps-5">{t('analyses.lots.lot')}</TableHead>
                  <TableHead>{t('analyses.stocks.produit')}</TableHead>
                  <TableHead className="text-end">{t('analyses.lots.stock')}</TableHead>
                  <TableHead className="pe-5">{t('analyses.anomalies.anomalie')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {anomalieRows.map((a) => (
                  <TableRow key={a.lot}>
                    <TableCell className="ps-5 font-mono text-xs">{a.lot}</TableCell>
                    <TableCell>{a.produit}</TableCell>
                    <TableCell className="text-end tabular-nums">{num(a.stock_actuel)}</TableCell>
                    {/* Free text from the data plane's quality check (French). */}
                    <TableCell className="pe-5" lang="fr">
                      <StatusBadge tone="danger">{a.anomalie}</StatusBadge>
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
