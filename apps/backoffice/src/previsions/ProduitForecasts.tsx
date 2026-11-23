import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@agricoop/ui';
import { History, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePrevisionsProduits } from '@/api/generated/previsions/previsions';
import { ok } from '@/api/ok';
import {
  DateText,
  EmptyState,
  ErrorAlert,
  NativeSelect,
  StatusBadge,
  useLocale,
} from '@/components/common';
import { DataCard, FilterBar, FilterChip, TableSkeleton } from '@/components/data';
import {
  famillesOf,
  formatQuantite,
  forWeek,
  isSimulation,
  latestCalcul,
  totalPrevu,
  versionsOf,
  weeksOf,
} from './produits';

/**
 * Weekly AI demand forecast per product (GET /api/v1/previsions/produits), written back by the
 * analytics pipeline. One week at a time (latest by default), optionally one family. The API
 * scopes rows to the signed-in coop; the week and family lists come from the rows themselves,
 * so one request feeds both the filters and the table.
 */
export function ProduitForecasts() {
  const { t } = useTranslation();
  const locale = useLocale();
  const query = usePrevisionsProduits();
  const rows = ok(query.data) ?? [];
  const weeks = weeksOf(rows);
  const [week, setWeek] = useState('');
  const [famille, setFamille] = useState('');
  const semaine = weeks.includes(week) ? week : (weeks[0] ?? '');
  const visible = forWeek(rows, semaine, famille);
  const simulation = visible.some((r) => isSimulation(r.type_prevision));
  const weekLabel = (date: string) =>
    t('previsions.weekOf', {
      date: new Intl.DateTimeFormat(locale === 'ar' ? 'ar-MA' : 'fr-MA', {
        dateStyle: 'medium',
        timeZone: 'UTC',
      }).format(new Date(`${date}T00:00:00Z`)),
    });

  return (
    <section aria-labelledby="previsions-produits" className="mt-10">
      <div className="mb-4">
        <h2 id="previsions-produits" className="font-display text-xl font-semibold">
          {t('previsionsProduit.title')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('previsionsProduit.subtitle')}</p>
      </div>

      {query.isPending ? (
        <TableSkeleton columns={4} rows={5} />
      ) : query.error ? (
        <ErrorAlert error={query.error} />
      ) : rows.length === 0 ? (
        <EmptyState icon={Sparkles} title={t('previsionsProduit.emptyTitle')}>
          {t('previsionsProduit.empty')}
        </EmptyState>
      ) : (
        <>
          <FilterBar
            active={famille !== ''}
            onReset={() => setFamille('')}
            end={
              <span className="text-sm text-muted-foreground tabular-nums">
                {t('previsionsProduit.total', {
                  count: visible.length,
                  quantite: formatQuantite(totalPrevu(visible)),
                })}
              </span>
            }
          >
            <label className="flex min-w-0 items-center gap-2 text-sm">
              <span className="text-muted-foreground">{t('previsionsProduit.semaine')}</span>
              <NativeSelect
                value={semaine}
                onChange={(e) => setWeek(e.target.value)}
                className="h-8 min-w-0"
              >
                {weeks.map((w) => (
                  <option key={w} value={w}>
                    {weekLabel(w)}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <FilterChip
              label={t('previsionsProduit.famille')}
              value={famille}
              onChange={setFamille}
              options={famillesOf(rows).map((f) => ({
                value: f,
                label: t(`famille.${f}`, { defaultValue: f }),
              }))}
            />
          </FilterBar>

          {simulation && (
            <p className="mb-4 flex items-start gap-2 rounded-lg border border-info/30 bg-info/10 px-4 py-3 text-sm text-foreground">
              <History className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
              {t('previsionsProduit.simulationNotice', { week: weekLabel(semaine) })}
            </p>
          )}

          {visible.length > 0 && (
            // Model version and calculation date: the same for a week's rows in practice, so one
            // line instead of two wide columns (the table then fits without scrolling sideways).
            <dl className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
              <div className="flex min-w-0 gap-1.5">
                <dt>{t('previsionsProduit.modele')} :</dt>
                <dd className="min-w-0 font-mono break-all" dir="ltr">
                  {versionsOf(visible).join(', ')}
                </dd>
              </div>
              <div className="flex gap-1.5">
                <dt>{t('previsionsProduit.calcul')} :</dt>
                <dd>
                  <DateText value={latestCalcul(visible)} withTime />
                </dd>
              </div>
            </dl>
          )}

          {visible.length === 0 ? (
            <EmptyState icon={Sparkles} title={t('common.noMatch')}>
              {t('common.noMatchHint')}
            </EmptyState>
          ) : (
            <DataCard>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('previsionsProduit.produit')}</TableHead>
                    <TableHead className="max-md:hidden">
                      {t('previsionsProduit.famille')}
                    </TableHead>
                    <TableHead className="text-end">{t('previsionsProduit.quantite')}</TableHead>
                    <TableHead className="max-sm:hidden">{t('previsionsProduit.type')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((r) => (
                    <TableRow key={`${r.produit_id}:${r.semaine}:${r.type_prevision}`}>
                      <TableCell className="whitespace-normal">
                        <span className="block font-medium">{r.nom_produit}</span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {r.code_produit}
                        </span>
                      </TableCell>
                      <TableCell className="max-md:hidden">
                        <Badge variant="outline">
                          {t(`famille.${r.famille}`, { defaultValue: r.famille })}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-end font-medium tabular-nums">
                        {formatQuantite(r.quantite_prevue)}
                      </TableCell>
                      <TableCell className="max-sm:hidden">
                        <span title={r.type_prevision}>
                          <StatusBadge tone={isSimulation(r.type_prevision) ? 'info' : 'success'}>
                            {isSimulation(r.type_prevision)
                              ? t('previsionsProduit.types.simulation')
                              : t('previsionsProduit.types.prevision')}
                          </StatusBadge>
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </DataCard>
          )}
        </>
      )}
    </section>
  );
}
