import { zodResolver } from '@hookform/resolvers/zod';
import { addDays, LOT_STATUTS, lotCreateSchema, type LotStatut } from '@agricoop/shared';
import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
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
  Loading,
  NativeSelect,
  PageHeader,
  Pagination,
  StatusBadge,
  SyntheticBadge,
  useErrorMessage,
} from '@/components/common';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  component: LotsPage,
});

const PAGE_SIZE = 20;

function LotsPage() {
  const { t } = useTranslation();
  const { synthetic } = usePreferences();
  const [statut, setStatut] = useState<LotStatut | 'tous'>('tous');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);

  const list = useLotsList({
    page,
    pageSize: PAGE_SIZE,
    synthetic,
    ...(statut !== 'tous' ? { statut } : {}),
  });
  const data = ok(list.data);

  return (
    <>
      <PageHeader
        title={t('lots.title')}
        description={t('lots.subtitle')}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" /> {t('lots.new')}
          </Button>
        }
      />
      <Tabs
        value={statut}
        onValueChange={(v) => {
          setStatut(v as typeof statut);
          setPage(1);
        }}
        className="mb-4"
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

      {list.isPending ? (
        <Loading />
      ) : list.error ? (
        <ErrorAlert error={list.error} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState>{t('lots.empty')}</EmptyState>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('lots.numero')}</TableHead>
                  <TableHead>{t('lots.produit')}</TableHead>
                  <TableHead>{t('lots.fabrication')}</TableHead>
                  <TableHead>{t('lots.peremption')}</TableHead>
                  <TableHead className="text-end">{t('lots.initiale')}</TableHead>
                  <TableHead className="text-end">{t('lots.stock')}</TableHead>
                  <TableHead>{t('lots.statut')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((l) => (
                  <TableRow key={l.lot_id}>
                    <TableCell className="font-mono text-xs">
                      <Link
                        to="/lots/$lotId"
                        params={{ lotId: l.lot_id }}
                        className="hover:underline"
                      >
                        {l.numero}
                      </Link>{' '}
                      <SyntheticBadge show={l.is_synthetic} />
                    </TableCell>
                    <TableCell>{l.produit_nom}</TableCell>
                    <TableCell>
                      <DateText value={l.date_fabrication} />
                    </TableCell>
                    <TableCell>
                      <DateText value={l.date_peremption} />
                    </TableCell>
                    <TableCell className="text-end tabular-nums">{l.quantite_initiale}</TableCell>
                    <TableCell className="text-end font-medium tabular-nums">{l.stock}</TableCell>
                    <TableCell>
                      <StatusBadge tone={lotTone[l.statut]}>
                        {t(`lotStatut.${l.statut}`)}
                      </StatusBadge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPage={setPage} />
        </>
      )}
      {creating && <LotDialog onClose={() => setCreating(false)} />}
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
  const err = (name: keyof FormInput) =>
    errors[name]?.message ? String(errors[name]?.message) : undefined;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('lots.new')}</DialogTitle>
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
