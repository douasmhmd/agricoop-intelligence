import { zodResolver } from '@hookform/resolvers/zod';
import {
  FAMILLES,
  formatMad,
  money,
  NIVEAUX_QR,
  type Produit,
  produitCreateSchema,
  produitUpdateSchema,
} from '@agricoop/shared';
import {
  Badge,
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenuItem,
  DropdownMenuSeparator,
  Input,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@agricoop/ui';
import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Package, Pencil, Plus, Power, QrCode, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { z } from 'zod';
import {
  useProduitsCreate,
  useProduitsList,
  useProduitsRemove,
  useProduitsUpdate,
} from '@/api/generated/produits/produits';
import { ok } from '@/api/ok';
import {
  EmptyState,
  ErrorAlert,
  Field,
  Money,
  NativeSelect,
  PageHeader,
  SyntheticBadge,
  useErrorMessage,
  useLocale,
} from '@/components/common';
import { DataCard, FilterBar, FilterChip, RowActions, TableSkeleton } from '@/components/data';
import { useConfirm } from '@/components/confirm';
import { usePreferences } from '@/state/preferences';

export const Route = createFileRoute('/produits')({
  // ?nouveau=1 opens the "new product" dialog (command palette action).
  validateSearch: (search: Record<string, unknown>): { nouveau?: 1 } =>
    search.nouveau ? { nouveau: 1 } : {},
  component: ProduitsPage,
});

type FormInput = z.input<typeof produitCreateSchema>;
type FormOutput = z.output<typeof produitCreateSchema>;
type Famille = (typeof FAMILLES)[number];
type Etat = 'true' | 'false';

function ProduitsPage() {
  const { t } = useTranslation();
  const { synthetic } = usePreferences();
  const [famille, setFamille] = useState<Famille | ''>('');
  const [etat, setEtat] = useState<Etat | ''>('');
  const [editing, setEditing] = useState<Produit | 'new' | null>(null);
  const { nouveau } = Route.useSearch();
  const navigate = useNavigate();
  const dialog = editing ?? (nouveau ? 'new' : null);
  const closeDialog = () => {
    setEditing(null);
    if (nouveau) void navigate({ to: '/produits', search: {}, replace: true });
  };
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const [confirm, confirmDialog] = useConfirm();

  const list = useProduitsList({
    synthetic,
    ...(famille ? { famille } : {}),
    ...(etat ? { actif: etat } : {}),
  });
  const update = useProduitsUpdate();
  const remove = useProduitsRemove();
  const produits = ok(list.data) ?? [];
  const filtered = Boolean(famille || etat);

  const refresh = () => queryClient.invalidateQueries();

  const toggleActif = (p: Produit) =>
    update.mutate(
      { produitId: p.produit_id, data: { actif: !p.actif } },
      { onSuccess: () => void refresh(), onError: (e) => toast.error(errorMessage(e)) },
    );

  const onDelete = async (p: Produit) => {
    const yes = await confirm({
      title: t('produits.confirmDelete', { code: p.code }),
      description: t('produits.deleteHint'),
      confirmLabel: t('common.delete'),
      destructive: true,
    });
    if (!yes) return;
    remove.mutate(
      { produitId: p.produit_id },
      {
        onSuccess: () => {
          toast.success(t('produits.deleted'));
          void refresh();
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  };

  return (
    <>
      <PageHeader
        title={t('produits.title')}
        description={t('produits.subtitle')}
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus /> {t('produits.new')}
          </Button>
        }
      />
      <FilterBar
        active={filtered}
        onReset={() => {
          setFamille('');
          setEtat('');
        }}
        end={
          list.isSuccess && (
            <span className="text-sm text-muted-foreground tabular-nums">
              {t('common.total', { count: produits.length })}
            </span>
          )
        }
      >
        <FilterChip
          label={t('produits.famille')}
          value={famille}
          onChange={setFamille}
          options={FAMILLES.map((f) => ({ value: f, label: t(`famille.${f}`) }))}
        />
        <FilterChip
          label={t('produits.etat')}
          value={etat}
          onChange={setEtat}
          options={[
            { value: 'true', label: t('produits.actifs') },
            { value: 'false', label: t('produits.inactifs') },
          ]}
        />
      </FilterBar>

      {list.isPending ? (
        <TableSkeleton columns={8} />
      ) : list.error ? (
        <ErrorAlert error={list.error} />
      ) : produits.length === 0 ? (
        <EmptyState
          icon={Package}
          title={filtered ? t('common.noMatch') : t('produits.emptyTitle')}
          action={
            !filtered && (
              <Button size="sm" onClick={() => setEditing('new')}>
                <Plus /> {t('produits.new')}
              </Button>
            )
          }
        >
          {filtered ? t('common.noMatchHint') : t('produits.empty')}
        </EmptyState>
      ) : (
        <DataCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('produits.produit')}</TableHead>
                <TableHead className="max-md:hidden">{t('produits.code')}</TableHead>
                <TableHead className="max-lg:hidden">{t('produits.famille')}</TableHead>
                <TableHead className="text-end">{t('produits.prix')}</TableHead>
                <TableHead className="text-end max-md:hidden">{t('produits.cout')}</TableHead>
                <TableHead className="text-end">{t('produits.marge')}</TableHead>
                <TableHead className="max-lg:hidden">{t('produits.niveauQr')}</TableHead>
                <TableHead>{t('produits.actif')}</TableHead>
                <TableHead>
                  <span className="sr-only">{t('common.actions')}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {produits.map((p) => (
                <TableRow key={p.produit_id}>
                  <TableCell className={cn(!p.actif && 'opacity-55')}>
                    <span className="flex items-center gap-2 font-medium">
                      {p.nom} <SyntheticBadge show={p.is_synthetic} />
                    </span>
                    <span className="text-xs text-muted-foreground">{p.categorie}</span>
                  </TableCell>
                  <TableCell className="font-mono text-xs max-md:hidden">{p.code}</TableCell>
                  <TableCell className="max-lg:hidden">
                    <Badge variant="outline">{t(`famille.${p.famille}`)}</Badge>
                  </TableCell>
                  <TableCell className="text-end font-medium">
                    <Money value={p.prix_mad} />
                  </TableCell>
                  <TableCell className="text-end text-muted-foreground max-md:hidden">
                    <Money value={p.cout_mad} />
                  </TableCell>
                  <TableCell
                    className={cn('text-end', p.marge_mad.startsWith('-') && 'text-destructive')}
                  >
                    <Money value={p.marge_mad} />
                    {p.marge_pct && (
                      <span className="ms-1.5 text-xs text-muted-foreground tabular-nums">
                        {p.marge_pct} %
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="max-lg:hidden">
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <QrCode className="size-3.5" aria-hidden />
                      {t(`niveauQr.${p.niveau_qr}`)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={p.actif}
                      onCheckedChange={() => toggleActif(p)}
                      aria-label={`${t('produits.actif')} — ${p.code}`}
                    />
                  </TableCell>
                  <TableCell className="text-end">
                    <RowActions label={p.code}>
                      <DropdownMenuItem onSelect={() => setEditing(p)}>
                        <Pencil /> {t('common.edit')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => toggleActif(p)}>
                        <Power /> {p.actif ? t('produits.desactiver') : t('produits.activer')}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onSelect={() => void onDelete(p)}>
                        <Trash2 /> {t('common.delete')}
                      </DropdownMenuItem>
                    </RowActions>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataCard>
      )}

      {dialog && (
        <ProduitDialog
          produit={dialog === 'new' ? undefined : dialog}
          onClose={closeDialog}
          onSaved={() => {
            closeDialog();
            void refresh();
          }}
        />
      )}
      {confirmDialog}
    </>
  );
}

/** Live margin under the price fields, once both amounts are valid. */
function MarginPreview({ prix, cout }: { prix?: string; cout?: string }) {
  const { t } = useTranslation();
  const locale = useLocale();
  let marge: ReturnType<typeof money> | null = null;
  let pct: string | null = null;
  try {
    if (prix && cout) {
      const p = money(prix);
      marge = p.minus(money(cout));
      pct = p.gt(0) ? marge.div(p).times(100).toDecimalPlaces(1).toString() : null;
    }
  } catch {
    marge = null;
  }
  if (!marge) return null;
  const negative = marge.isNeg();
  return (
    <p
      className={cn(
        'rounded-lg border px-3 py-2 text-sm sm:col-span-2',
        negative
          ? 'border-destructive/30 bg-destructive/10 text-destructive'
          : 'border-success/25 bg-success/10 text-success',
      )}
    >
      {t('produits.margePreview')}{' '}
      <strong className="tabular-nums">
        {negative && '−'}
        {formatMad(marge.abs().toFixed(2), locale)}
      </strong>
      {pct !== null && <span className="tabular-nums"> · {pct.replace('.', ',')} %</span>}
    </p>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
      <legend className="mb-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function ProduitDialog({
  produit,
  onClose,
  onSaved,
}: {
  produit?: Produit;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const create = useProduitsCreate();
  const update = useProduitsUpdate();
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(produitCreateSchema),
    defaultValues: produit
      ? {
          code: produit.code,
          nom: produit.nom,
          famille: produit.famille,
          categorie: produit.categorie,
          prix_mad: produit.prix_mad,
          cout_mad: produit.cout_mad,
          conservation_j: produit.conservation_j,
          huile_ml_par_unite: produit.huile_ml_par_unite,
          niveau_qr: produit.niveau_qr,
          actif: produit.actif,
        }
      : { famille: 'alimentaire', niveau_qr: 'lot', huile_ml_par_unite: 0, actif: true },
  });
  const { errors } = form.formState;
  const pending = create.isPending || update.isPending;
  const prix = form.watch('prix_mad');
  const cout = form.watch('cout_mad');

  const onSubmit = form.handleSubmit((values) => {
    const done = {
      onSuccess: () => {
        toast.success(t('common.saved'));
        onSaved();
      },
      onError: (e: unknown) => toast.error(errorMessage(e)),
    };
    if (produit)
      update.mutate(
        { produitId: produit.produit_id, data: produitUpdateSchema.parse(values) },
        done,
      );
    else create.mutate({ data: values }, done);
  });

  // An empty number field is NaN for Zod ("invalid_type"): say "required" instead.
  const err = (name: keyof FormInput) =>
    errors[name]?.type === 'invalid_type'
      ? t('common.required')
      : errors[name]?.message
        ? String(errors[name]?.message)
        : undefined;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{produit ? t('produits.edit') : t('produits.new')}</DialogTitle>
          <DialogDescription>
            {produit ? `${produit.code} — ${produit.nom}` : t('produits.newHint')}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void onSubmit(e)} className="grid gap-6 sm:grid-cols-2" noValidate>
          <FormSection title={t('produits.sectionIdentite')}>
            <Field label={t('produits.code')} error={err('code')}>
              <Input {...form.register('code')} placeholder="HVE-1L" dir="ltr" />
            </Field>
            <Field label={t('produits.nom')} error={err('nom')}>
              <Input {...form.register('nom')} />
            </Field>
            <Field label={t('produits.famille')} error={err('famille')}>
              <NativeSelect {...form.register('famille')}>
                {FAMILLES.map((f) => (
                  <option key={f} value={f}>
                    {t(`famille.${f}`)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field
              label={t('produits.categorie')}
              error={err('categorie')}
              hint={t('produits.categorieHint')}
            >
              <Input {...form.register('categorie')} placeholder="huile" dir="ltr" />
            </Field>
          </FormSection>
          <FormSection title={t('produits.sectionPrix')}>
            <Field label={t('produits.prix')} error={err('prix_mad')}>
              <Input
                {...form.register('prix_mad')}
                inputMode="decimal"
                placeholder="75.00"
                dir="ltr"
              />
            </Field>
            <Field label={t('produits.cout')} error={err('cout_mad')}>
              <Input
                {...form.register('cout_mad')}
                inputMode="decimal"
                placeholder="41.25"
                dir="ltr"
              />
            </Field>
            <MarginPreview prix={prix} cout={cout} />
          </FormSection>
          <FormSection title={t('produits.sectionTracabilite')}>
            <Field label={t('produits.conservation')} error={err('conservation_j')}>
              <Input
                type="number"
                min={1}
                {...form.register('conservation_j', { valueAsNumber: true })}
              />
            </Field>
            <Field label={t('produits.huileMl')} error={err('huile_ml_par_unite')}>
              <Input
                type="number"
                min={0}
                {...form.register('huile_ml_par_unite', { valueAsNumber: true })}
              />
            </Field>
            <Field
              label={t('produits.niveauQr')}
              error={err('niveau_qr')}
              hint={t('produits.niveauQrHint')}
            >
              <NativeSelect {...form.register('niveau_qr')}>
                {NIVEAUX_QR.map((n) => (
                  <option key={n} value={n}>
                    {t(`niveauQr.${n}`)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </FormSection>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={pending}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
