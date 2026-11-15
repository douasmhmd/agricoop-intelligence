import { Tabs, TabsContent, TabsList, TabsTrigger } from '@agricoop/ui';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Boxes, ChartColumn, QrCode, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ClientsTab } from '@/analytics/ClientsTab';
import { QrTab } from '@/analytics/QrTab';
import { StocksTab } from '@/analytics/StocksTab';
import { VentesTab } from '@/analytics/VentesTab';
import { PageHeader } from '@/components/common';

const ONGLETS = ['ventes', 'stocks', 'clients', 'qr'] as const;
type Onglet = (typeof ONGLETS)[number];

/*
 * Analyses: the data plane's gold layer (contracts/api/analytics.yaml) — sales KPIs per campaign,
 * stock cover, customer segments and suspected counterfeit QR codes. Read-only; the tab is in the
 * URL (?onglet=) so a view can be shared.
 */
export const Route = createFileRoute('/analyses')({
  validateSearch: (search: Record<string, unknown>): { onglet?: Onglet } =>
    ONGLETS.includes(search.onglet as Onglet) && search.onglet !== 'ventes'
      ? { onglet: search.onglet as Onglet }
      : {},
  component: AnalysesPage,
});

const ICONS = { ventes: ChartColumn, stocks: Boxes, clients: Users, qr: QrCode } as const;

function AnalysesPage() {
  const { t } = useTranslation();
  const { onglet = 'ventes' } = Route.useSearch();
  const navigate = useNavigate({ from: '/analyses' });

  return (
    <>
      <PageHeader title={t('analyses.title')} description={t('analyses.subtitle')} />
      <Tabs
        value={onglet}
        onValueChange={(v) =>
          void navigate({ search: v === 'ventes' ? {} : { onglet: v as Onglet }, replace: true })
        }
        className="gap-5"
      >
        <TabsList className="max-w-full overflow-x-auto">
          {ONGLETS.map((o) => {
            const Icon = ICONS[o];
            return (
              <TabsTrigger key={o} value={o}>
                <Icon aria-hidden className="max-sm:hidden" /> {t(`analyses.tabs.${o}`)}
              </TabsTrigger>
            );
          })}
        </TabsList>
        <TabsContent value="ventes">
          <VentesTab />
        </TabsContent>
        <TabsContent value="stocks">
          <StocksTab />
        </TabsContent>
        <TabsContent value="clients">
          <ClientsTab />
        </TabsContent>
        <TabsContent value="qr">
          <QrTab />
        </TabsContent>
      </Tabs>
    </>
  );
}
