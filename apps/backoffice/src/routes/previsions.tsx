import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { usePrevisionsSeries, usePrevisionsVersions } from '@/api/generated/previsions/previsions';
import { ok } from '@/api/ok';
import {
  EmptyState,
  ErrorAlert,
  Loading,
  NativeSelect,
  PageHeader,
  useLocale,
} from '@/components/common';
import { Card, CardContent, CardHeader, CardTitle } from '@agricoop/ui';
import { usePreferences } from '@/state/preferences';

export const Route = createFileRoute('/previsions')({
  component: PrevisionsPage,
});

function PrevisionsPage() {
  const { t } = useTranslation();
  const locale = useLocale();
  const { synthetic } = usePreferences();
  const versions = usePrevisionsVersions();
  const [version, setVersion] = useState('');
  const series = usePrevisionsSeries({
    synthetic,
    ...(version ? { version_modele: version } : {}),
  });
  const data = ok(series.data);
  const versionList = ok(versions.data) ?? [];
  const weekFmt = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-MA' : 'fr-MA', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  });

  return (
    <>
      <PageHeader
        title={t('previsions.title')}
        description={t('previsions.subtitle')}
        actions={
          <NativeSelect
            value={version || data?.version_modele || ''}
            onChange={(e) => setVersion(e.target.value)}
            aria-label={t('previsions.version')}
            disabled={versionList.length === 0}
          >
            {versionList.length === 0 && <option value="">{t('previsions.noVersion')}</option>}
            {versionList.map((v) => (
              <option key={v.version_modele} value={v.version_modele}>
                {v.version_modele}
              </option>
            ))}
          </NativeSelect>
        }
      />
      {series.isPending ? (
        <Loading />
      ) : series.error ? (
        <ErrorAlert error={series.error} />
      ) : !data || data.series.length === 0 ? (
        <EmptyState>{t('previsions.empty')}</EmptyState>
      ) : (
        <>
          {!data.version_modele && (
            <p className="mb-4 text-sm text-muted-foreground">{t('previsions.salesOnly')}</p>
          )}
          <div className="grid gap-6 xl:grid-cols-2">
            {data.series.map((s) => (
              <Card key={s.famille}>
                <CardHeader>
                  <CardTitle>{t(`famille.${s.famille}`, { defaultValue: s.famille })}</CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Charts stay LTR: time flows left to right in both languages. */}
                  <div className="h-72" dir="ltr">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={s.points.map((p) => ({
                          semaine: p.semaine,
                          prevue: p.quantite_prevue === null ? null : Number(p.quantite_prevue),
                          vendue: p.quantite_vendue,
                        }))}
                        margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="semaine"
                          tickFormatter={(v: string) => weekFmt.format(new Date(`${v}T00:00:00Z`))}
                          minTickGap={24}
                        />
                        <YAxis allowDecimals={false} width={40} />
                        <Tooltip
                          labelFormatter={(v) =>
                            t('previsions.weekOf', { date: typeof v === 'string' ? v : '' })
                          }
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="vendue"
                          name={t('previsions.vendue')}
                          stroke="var(--chart-1)"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="prevue"
                          name={t('previsions.prevue')}
                          stroke="var(--chart-2)"
                          strokeWidth={2}
                          strokeDasharray="6 4"
                          dot={false}
                          connectNulls={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </>
  );
}
