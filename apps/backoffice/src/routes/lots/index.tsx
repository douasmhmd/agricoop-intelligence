import { zodResolver } from '@hookform/resolvers/zod';
import {
  addDays,
  daysBetween,
  isoDateInZone,
  LOT_STATUTS,
  lotCreateSchema,
  type LotStatut,
} from '@agricoop/shared';
import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { Boxes, Eye, Plus, Printer } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { z } from 'zod';
import { useLotsCreate, useLotsList } from '@/api/generated/lots/lots';
import { useProduitsList } from '@/api/generated/produits/produits';
import { ok } from '@/api/ok';
import {
  DateText,
  EmptyState,
  ErrorAlert,
  Field,
  NativeSelect,
  PageHeader,
  Pagination,
  StatusBadge,
  SyntheticBadge,
  useErrorMessage,
} from '@/components/common';
import {
  DataCard,
  ExpiryBar,
  FilterBar,
  FilterChip,
  RowActions,
  TableSkeleton,
} from '@/components/data';
import { useConfirm } from '@/components/confirm';
import { usePrintLabels } from '@/lots/labels';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenuItem,
  Input,
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
import { lotTone } from '@/lib/tones';
import { usePreferences } from '@/state/preferences';

export const Route = createFileRoute('/lots/')({
  // ?nouveau=1 opens the "new lot" dialog (command palette action).
  validateSearch: (search: Record<string, unknown>): { nouveau?: 1 } =>
    search.nouveau ? { nouveau: 1 } : {},
  component: LotsPage,
});

const PAGE_SIZE = 20;

function LotsPage() {
  const { t } = useTranslation();
  const { synthetic } = usePreferences();
  const [statut, setStatut] = useState<LotStatut | 'tous'>('tous');
  const [produitId, setProduitId] = useState('');
  const [page, setPage] = useState(1);
  const [confirm, confirmDialog] = useConfirm();
  const labels = usePrintLabels(confirm);
  const produits = ok(useProduitsList({ synthetic }).data) ?? [];
  const today = isoDateInZone(new Date());
  const [creatingState, setCreating] = useState(false);
  const { nouveau } = Route.useSearch();
  const creating = creatingState || nouveau === 1;
  const navigate = useNavigate();

  const list = useLotsList({
    page,
    pageSize: PAGE_SIZE,
    synthetic,
    ...(statut !== 'tous' ? { statut } : {}),
    ...(produitId ? { produit_id: produitId } : {}),
  });
  const filtered = statut !== 'tous' || Boolean(produitId);
  const data = ok(list.data);

  return (
    <>
      <PageHeader
        title={t('lots.title')}
        description={t('lots.subtitle')}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus /> {t('lots.new')}
          </Button>
        }
      />
      <FilterBar
        active={filtered}
        onReset={() => {
          setStatut('tous');
          setProduitId('');
          setPage(1);
        }}
      >
        <Tabs
          value={statut}
          onValueChange={(v) => {
            setStatut(v as typeof statut);
            setPage(1);
          }}
        >
          <TabsList>
            <TabsTrigger value="tous">{t('lots.tous')}</TabsTrigger>
            {LOT_STATUTS.map((s) => (
              <TabsTrigger key={s} value={s}>
                {t(`lotStatut.${s}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <FilterChip
          label={t('lots.produit')}
          value={produitId}
          onChange={(v) => {
            setProduitId(v);
            setPage(1);
          }}
          options={produits.map((p) => ({ value: p.produit_id, label: `${p.code} — ${p.nom}` }))}
        />
      </FilterBar>

      {list.isPending ? (
        <TableSkeleton columns={7} />
      ) : list.error ? (
        <ErrorAlert error={list.error} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title={filtered ? t('common.noMatch') : t('lots.emptyTitle')}
          action={
            !filtered && (
              <Button size="sm" onClick={() => setCreating(true)}>
                <Plus /> {t('lots.new')}
              </Button>
            )
          }
        >
          {filtered ? t('common.noMatchHint') : t('lots.empty')}
        </EmptyState>
      ) : (
        <>
          <DataCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('lots.numero')}</TableHead>
                  <TableHead className="max-md:hidden">{t('lots.produit')}</TableHead>
                  <TableHead className="max-lg:hidden">{t('lots.fabrication')}</TableHead>
                  <TableHead>{t('lots.peremption')}</TableHead>
                  <TableHead className="text-end">{t('lots.stock')}</TableHead>
                  <TableHead>{t('lots.statut')}</TableHead>
                  <TableHead>
                    <span className="sr-only">{t('common.actions')}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((l) => (
                  <TableRow key={l.lot_id}>
                    <TableCell className="font-mono text-xs">
                      <span className="flex items-center gap-2">
                        <Link
                          to="/lots/$lotId"
                          params={{ lotId: l.lot_id }}
                          className="font-medium text-foreground hover:text-primary hover:underline"
                        >
                          {l.numero}
                        </Link>
                        <SyntheticBadge show={l.is_synthetic} />
                      </span>
                    </TableCell>
                    <TableCell className="max-md:hidden">
                      <span className="font-medium">{l.produit_nom}</span>
                      <span className="block font-mono text-xs text-muted-foreground">
                        {l.produit_code}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-lg:hidden">
                      <DateText value={l.date_fabrication} />
                    </TableCell>
                    <TableCell>
                      <DateText value={l.date_peremption} />
                      {l.statut === 'disponible' && (
                        <ExpiryBar
                          jours={daysBetween(today, l.date_peremption)}
                          className="mt-1 max-w-44"
                        />
                      )}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      <span className="font-semibold">{l.stock}</span>
                      <span className="text-muted-foreground"> / {l.quantite_initiale}</span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={lotTone[l.statut]}>
                        {t(`lotStatut.${l.statut}`)}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-end">
                      <RowActions label={l.numero}>
                        <DropdownMenuItem asChild>
                          <Link to="/lots/$lotId" params={{ lotId: l.lot_id }}>
                            <Eye /> {t('lots.open')}
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={labels.printing === l.lot_id}
                          onSelect={() => void labels.print(l.lot_id, l.numero)}
                        >
                          <Printer /> {t('qr.printLabels')}
                        </DropdownMenuItem>
                      </RowActions>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataCard>
          <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPage={setPage} />
        </>
      )}
      {creating && (
        <LotDialog
          onClose={() => {
            setCreating(false);
            if (nouveau) void navigate({ to: '/lots', search: {}, replace: true });
          }}
        />
      )}
      {confirmDialog}
    </>
  );
}

type FormInput = z.input<typeof lotCreateSchema>;
type FormOutput = z.output<typeof lotCreateSchema>;

function LotDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const produits = (ok(useProduitsList({ actif: 'true' }).data) ?? []).filter((p) => p.actif);
  const create = useLotsCreate();
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(lotCreateSchema),
    defaultValues: { date_fabrication: new Date().toISOString().slice(0, 10) },
  });
  const { errors } = form.formState;
  const produitId = form.watch('produit_id');
  const fabrication = form.watch('date_fabrication');
  const selected = produits.find((p) => p.produit_id === produitId);
  const defaultExpiry =
    selected && /^\d{4}-\d{2}-\d{2}$/.test(fabrication ?? '')
      ? addDays(fabrication, selected.conservation_j)
      : undefined;

  const onSubmit = form.handleSubmit((values) =>
    create.mutate(
      { data: { ...values, ...(values.date_peremption ? {} : { date_peremption: undefined }) } },
      {
        onSuccess: (res) => {
          toast.success(t('lots.created'));
          void queryClient.invalidateQueries();
          const lot = ok(res);
          onClose();
          if (lot) void navigate({ to: '/lots/$lotId', params: { lotId: lot.lot_id } });
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    ),
  );
  // An empty number field is NaN for Zod ("invalid_type"): say "required" instead.
  const err = (name: keyof FormInput) =>
    errors[name]?.type === 'invalid_type'
      ? t('common.required')
      : errors[name]?.message
        ? String(errors[name]?.message)
        : undefined;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('lots.new')}</DialogTitle>
          <DialogDescription>{t('lots.newHint')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void onSubmit(e)} className="grid gap-4" noValidate>
          <Field label={t('lots.produit')} error={err('produit_id')}>
            <NativeSelect {...form.register('produit_id')} defaultValue="">
              <option value="" disabled>
                {t('lots.chooseProduit')}
              </option>
              {produits.map((p) => (
                <option key={p.produit_id} value={p.produit_id}>
                  {p.code} — {p.nom}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label={t('lots.numero')} error={err('numero')}>
            <Input {...form.register('numero')} placeholder="HVE-1L-2026-001" dir="ltr" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('lots.fabrication')} error={err('date_fabrication')}>
              <Input type="date" {...form.register('date_fabrication')} />
            </Field>
            <Field
              label={t('lots.peremption')}
              error={err('date_peremption')}
              hint={defaultExpiry ? t('lots.defaultExpiry', { date: defaultExpiry }) : undefined}
            >
              <Input
                type="date"
                {...form.register('date_peremption', { setValueAs: (v: string) => v || undefined })}
              />
            </Field>
          </div>
          <Field
            label={t('lots.quantite')}
            error={err('quantite_initiale')}
            hint={selected?.niveau_qr === 'unite' ? t('lots.unitesHint') : undefined}
          >
            <Input
              type="number"
              min={1}
              {...form.register('quantite_initiale', { valueAsNumber: true })}
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
