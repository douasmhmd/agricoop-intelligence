import { isoDateInZone, mondayOf } from '@agricoop/shared';
import { stagger } from '@agricoop/ui/motion';
import { createFileRoute } from '@tanstack/react-router';
import { ChartLine } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePrevisionsSeries, usePrevisionsVersions } from '@/api/generated/previsions/previsions';
import { ok } from '@/api/ok';
import { EmptyState, ErrorAlert, NativeSelect, PageHeader } from '@/components/common';
import { ChartCard, ChartSkeleton, SalesForecastChart } from '@/dashboard/charts';
import { ProduitForecasts } from '@/previsions/ProduitForecasts';
import { usePreferences } from '@/state/preferences';

export const Route = createFileRoute('/previsions')({
  component: PrevisionsPage,
});

function PrevisionsPage() {
  const { t } = useTranslation();
  const { synthetic } = usePreferences();
  const versions = usePrevisionsVersions();
  const [version, setVersion] = useState('');
  const series = usePrevisionsSeries({
    synthetic,
    ...(version ? { version_modele: version } : {}),
  });
  const data = ok(series.data);
  const versionList = ok(versions.data) ?? [];
  const thisWeek = mondayOf(isoDateInZone(new Date()));

  return (
    <>
      <PageHeader
        title={t('previsions.title')}
        description={t('previsions.subtitle')}
        actions={
          <label className="flex max-w-full min-w-0 flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">{t('previsions.version')}</span>
            <NativeSelect
              value={version || data?.version_modele || ''}
              onChange={(e) => setVersion(e.target.value)}
              disabled={versionList.length === 0}
              className="max-w-full min-w-0 truncate"
            >
              {versionList.length === 0 && <option value="">{t('previsions.noVersion')}</option>}
              {versionList.map((v) => (
                <option key={v.version_modele} value={v.version_modele}>
                  {v.version_modele}
                </option>
              ))}
            </NativeSelect>
          </label>
        }
      />
      {series.isPending ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-xl border bg-card py-5">
              <ChartSkeleton />
            </div>
          ))}
        </div>
      ) : series.error ? (
        <ErrorAlert error={series.error} />
      ) : !data || data.series.length === 0 ? (
        <EmptyState icon={ChartLine} title={t('previsions.emptyTitle')}>
          {t('previsions.empty')}
        </EmptyState>
      ) : (
        <>
          {!data.version_modele && (
            <p className="mb-4 rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
              {t('previsions.salesOnly')}
            </p>
          )}
          <motion.div
            variants={stagger(0.06)}
            initial="hidden"
            animate="visible"
            className="grid gap-4 xl:grid-cols-2"
          >
            {data.series.map((s) => {
              const points = s.points.map((p) => ({
                semaine: p.semaine,
                vendues: p.quantite_vendue,
                // Chart coordinates only (no arithmetic on the decimal string).
                prevues: p.quantite_prevue === null ? null : Number(p.quantite_prevue),
              }));
              // First forecast for this week or later.
              const next = s.points.find(
                (p) => p.quantite_prevue !== null && p.semaine >= thisWeek,
              );
              return (
                <ChartCard
                  key={s.famille}
                  title={t(`famille.${s.famille}`, { defaultValue: s.famille })}
                  description={
                    next?.quantite_prevue
                      ? t('previsions.nextWeek', {
                          quantite: next.quantite_prevue.replace(/\.0+$/, ''),
                        })
                      : t('previsions.chartHint')
                  }
                >
                  <SalesForecastChart data={points} />
                  <div className="flex items-center justify-center gap-5 pt-2 pb-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-4 rounded-sm bg-chart-1/70" /> {t('previsions.vendue')}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-0 w-4 border-t-2 border-dashed border-chart-2" />{' '}
                      {t('previsions.prevue')}
                    </span>
                  </div>
                </ChartCard>
              );
            })}
          </motion.div>
        </>
      )}
      <ProduitForecasts />
    </>
  );
}
