import {
  CANAUX,
  COMMANDE_STATUTS,
  COMMANDE_TRANSITIONS,
  type Canal,
  type CommandeStatut,
} from '@agricoop/shared';
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@agricoop/ui';
import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Ban, CircleCheck, CreditCard, Eye, ShoppingCart, Truck } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useCommandesChangeStatut, useCommandesList } from '@/api/generated/commandes/commandes';
import { ok } from '@/api/ok';
import {
  DateText,
  EmptyState,
  ErrorAlert,
  Money,
  PageHeader,
  Pagination,
  StatusBadge,
  SyntheticBadge,
  useErrorMessage,
} from '@/components/common';
import { DataCard, FilterBar, FilterChip, RowActions, TableSkeleton } from '@/components/data';
import { useConfirm } from '@/components/confirm';
import { commandeTone } from '@/lib/tones';
import { usePreferences } from '@/state/preferences';

export const Route = createFileRoute('/commandes/')({
  component: CommandesPage,
});

const PAGE_SIZE = 20;

type Next = 'payee' | 'expediee' | 'livree' | 'annulee';
const ACTION_ICON = { payee: CreditCard, expediee: Truck, livree: CircleCheck, annulee: Ban };

function CommandesPage() {
  const { t } = useTranslation();
  const { synthetic } = usePreferences();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const [confirm, confirmDialog] = useConfirm();
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
  const change = useCommandesChangeStatut();
  const data = ok(query.data);
  const filtered = Boolean(statut || canal);

  const setCommandeStatut = async (commandeId: string, next: Next) => {
    if (
      next === 'annulee' &&
      !(await confirm({
        title: t('commandes.cancelTitle'),
        description: t('commandes.confirmCancel'),
        confirmLabel: t('commandes.action.annulee'),
        destructive: true,
      }))
    )
      return;
    change.mutate(
      { commandeId, data: { statut: next } },
      {
        onSuccess: () => {
          toast.success(t('commandes.updated'));
          void queryClient.invalidateQueries();
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  };

  return (
    <>
      <PageHeader title={t('commandes.title')} description={t('commandes.subtitle')} />
      <FilterBar
        active={filtered}
        onReset={() => {
          setStatut('');
          setCanal('');
          setPage(1);
        }}
      >
        <FilterChip
          label={t('commandes.statut')}
          value={statut}
          onChange={(v) => {
            setStatut(v);
            setPage(1);
          }}
          options={COMMANDE_STATUTS.map((s) => ({ value: s, label: t(`statut.${s}`) }))}
        />
        <FilterChip
          label={t('commandes.canal')}
          value={canal}
          onChange={(v) => {
            setCanal(v);
            setPage(1);
          }}
          options={CANAUX.map((c) => ({ value: c, label: t(`canal.${c}`) }))}
        />
      </FilterBar>

      {query.isPending ? (
        <TableSkeleton columns={8} />
      ) : query.error ? (
        <ErrorAlert error={query.error} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title={filtered ? t('common.noMatch') : t('commandes.emptyTitle')}
        >
          {filtered ? t('common.noMatchHint') : t('commandes.empty')}
        </EmptyState>
      ) : (
        <>
          <DataCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('commandes.ref')}</TableHead>
                  <TableHead className="max-sm:hidden">{t('commandes.date')}</TableHead>
                  <TableHead className="max-md:hidden">{t('commandes.canal')}</TableHead>
                  <TableHead className="max-md:hidden">{t('commandes.ville')}</TableHead>
                  <TableHead>{t('commandes.statut')}</TableHead>
                  <TableHead className="text-end max-md:hidden">{t('commandes.lignes')}</TableHead>
                  <TableHead className="text-end">{t('commandes.montant')}</TableHead>
                  <TableHead>
                    <span className="sr-only">{t('common.actions')}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((c) => {
                  const ref = c.commande_id.slice(0, 8).toUpperCase();
                  const next = COMMANDE_TRANSITIONS[c.statut].filter(
                    (s): s is Next => s !== 'creee',
                  );
                  return (
                    <TableRow key={c.commande_id}>
                      <TableCell className="font-mono text-xs">
                        <span className="flex items-center gap-2">
                          <Link
                            to="/commandes/$commandeId"
                            params={{ commandeId: c.commande_id }}
                            className="font-medium text-foreground hover:text-primary hover:underline"
                          >
                            {ref}
                          </Link>
                          <SyntheticBadge show={c.is_synthetic} />
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-sm:hidden">
                        <DateText value={c.date_commande} withTime />
                      </TableCell>
                      <TableCell className="max-md:hidden">{t(`canal.${c.canal}`)}</TableCell>
                      <TableCell className="max-md:hidden">{c.ville}</TableCell>
                      <TableCell>
                        <StatusBadge tone={commandeTone[c.statut]}>
                          {t(`statut.${c.statut}`)}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="text-end tabular-nums max-md:hidden">
                        {c.nb_lignes}
                      </TableCell>
                      <TableCell className="text-end font-semibold">
                        <Money value={c.montant_total_mad} />
                      </TableCell>
                      <TableCell className="text-end">
                        <RowActions label={ref}>
                          <DropdownMenuItem asChild>
                            <Link
                              to="/commandes/$commandeId"
                              params={{ commandeId: c.commande_id }}
                            >
                              <Eye /> {t('commandes.open')}
                            </Link>
                          </DropdownMenuItem>
                          {next.length > 0 && <DropdownMenuSeparator />}
                          {next.map((s) => {
                            const Icon = ACTION_ICON[s];
                            return (
                              <DropdownMenuItem
                                key={s}
                                variant={s === 'annulee' ? 'destructive' : 'default'}
                                disabled={change.isPending}
                                onSelect={() => void setCommandeStatut(c.commande_id, s)}
                              >
                                <Icon /> {t(`commandes.action.${s}`)}
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
      {confirmDialog}
    </>
  );
}
