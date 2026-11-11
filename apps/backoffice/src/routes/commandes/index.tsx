import { CANAUX, COMMANDE_STATUTS, type Canal, type CommandeStatut } from '@agricoop/shared';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCommandesList } from '@/api/generated/commandes/commandes';
import { ok } from '@/api/ok';
import {
  DateText,
  EmptyState,
  ErrorAlert,
  Loading,
  Money,
  NativeSelect,
  PageHeader,
  Pagination,
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
} from '@/components/ui/table';
import { commandeTone } from '@/lib/tones';
import { usePreferences } from '@/state/preferences';

export const Route = createFileRoute('/commandes/')({
  component: CommandesPage,
});

const PAGE_SIZE = 20;

function CommandesPage() {
  const { t } = useTranslation();
  const { synthetic } = usePreferences();
  const [statut, setStatut] = useState<CommandeStatut | ''>('');
  const [canal, setCanal] = useState<Canal | ''>('');
  const [page, setPage] = useState(1);
  const query = useCommandesList({
    page,
    pageSize: PAGE_SIZE,
    synthetic,
    ...(statut ? { statut } : {}),
    ...(canal ? { canal } : {}),
  });
  const data = ok(query.data);

  return (
    <>
      <PageHeader title={t('commandes.title')} description={t('commandes.subtitle')} />
      <div className="mb-4 flex flex-wrap gap-2">
        <NativeSelect
          value={statut}
          onChange={(e) => {
            setStatut(e.target.value as typeof statut);
            setPage(1);
          }}
          aria-label={t('commandes.statut')}
        >
          <option value="">{t('commandes.allStatuts')}</option>
          {COMMANDE_STATUTS.map((s) => (
            <option key={s} value={s}>
              {t(`statut.${s}`)}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          value={canal}
          onChange={(e) => {
            setCanal(e.target.value as typeof canal);
            setPage(1);
          }}
          aria-label={t('commandes.canal')}
        >
          <option value="">{t('commandes.allCanaux')}</option>
          {CANAUX.map((c) => (
            <option key={c} value={c}>
              {t(`canal.${c}`)}
            </option>
          ))}
        </NativeSelect>
      </div>

      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorAlert error={query.error} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState>{t('commandes.empty')}</EmptyState>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('commandes.date')}</TableHead>
                  <TableHead>{t('commandes.ref')}</TableHead>
                  <TableHead>{t('commandes.canal')}</TableHead>
                  <TableHead>{t('commandes.ville')}</TableHead>
                  <TableHead>{t('commandes.statut')}</TableHead>
                  <TableHead className="text-end">{t('commandes.lignes')}</TableHead>
                  <TableHead className="text-end">{t('commandes.montant')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((c) => (
                  <TableRow key={c.commande_id}>
                    <TableCell>
                      <DateText value={c.date_commande} withTime />
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      <Link
                        to="/commandes/$commandeId"
                        params={{ commandeId: c.commande_id }}
                        className="hover:underline"
                      >
                        {c.commande_id.slice(0, 8).toUpperCase()}
                      </Link>{' '}
                      <SyntheticBadge show={c.is_synthetic} />
                    </TableCell>
                    <TableCell>{t(`canal.${c.canal}`)}</TableCell>
                    <TableCell>{c.ville}</TableCell>
                    <TableCell>
                      <StatusBadge tone={commandeTone[c.statut]}>
                        {t(`statut.${c.statut}`)}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-end tabular-nums">{c.nb_lignes}</TableCell>
                    <TableCell className="text-end">
                      <Money value={c.montant_total_mad} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPage={setPage} />
        </>
      )}
    </>
  );
}
