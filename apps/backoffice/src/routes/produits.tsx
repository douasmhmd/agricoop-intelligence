import { zodResolver } from '@hookform/resolvers/zod';
import {
  FAMILLES,
  NIVEAUX_QR,
  type Produit,
  produitCreateSchema,
  produitUpdateSchema,
} from '@agricoop/shared';
import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Pencil, Plus, Trash2 } from 'lucide-react';
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
  Loading,
  Money,
  NativeSelect,
  PageHeader,
  SyntheticBadge,
  useErrorMessage,
} from '@/components/common';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePreferences } from '@/state/preferences';

export const Route = createFileRoute('/produits')({
  component: ProduitsPage,
});

type FormInput = z.input<typeof produitCreateSchema>;
type FormOutput = z.output<typeof produitCreateSchema>;

function ProduitsPage() {
  const { t } = useTranslation();
  const { synthetic } = usePreferences();
  const [famille, setFamille] = useState<(typeof FAMILLES)[number] | ''>('');
  const [editing, setEditing] = useState<Produit | 'new' | null>(null);
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();

  const list = useProduitsList({ synthetic, ...(famille ? { famille } : {}) });
  const update = useProduitsUpdate();
  const remove = useProduitsRemove();
  const produits = ok(list.data) ?? [];

  const refresh = () => queryClient.invalidateQueries();

  const toggleActif = (p: Produit) =>
    update.mutate(
      { produitId: p.produit_id, data: { actif: !p.actif } },
      { onSuccess: () => void refresh(), onError: (e) => toast.error(errorMessage(e)) },
    );

  const onDelete = (p: Produit) => {
    if (!window.confirm(t('produits.confirmDelete', { code: p.code }))) return;
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
            <Plus className="size-4" /> {t('produits.new')}
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <NativeSelect
          value={famille}
          onChange={(e) => setFamille(e.target.value as typeof famille)}
          aria-label={t('produits.famille')}
        >
          <option value="">{t('produits.allFamilles')}</option>
          {FAMILLES.map((f) => (
            <option key={f} value={f}>
              {t(`famille.${f}`)}
            </option>
          ))}
        </NativeSelect>
      </div>

      {list.isPending ? (
        <Loading />
      ) : list.error ? (
        <ErrorAlert error={list.error} />
      ) : produits.length === 0 ? (
        <EmptyState>{t('produits.empty')}</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('produits.code')}</TableHead>
                <TableHead>{t('produits.nom')}</TableHead>
                <TableHead>{t('produits.famille')}</TableHead>
                <TableHead className="text-end">{t('produits.prix')}</TableHead>
                <TableHead className="text-end">{t('produits.cout')}</TableHead>
                <TableHead className="text-end">{t('produits.marge')}</TableHead>
                <TableHead>{t('produits.niveauQr')}</TableHead>
                <TableHead>{t('produits.actif')}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {produits.map((p) => (
                <TableRow key={p.produit_id} className={p.actif ? '' : 'opacity-60'}>
                  <TableCell className="font-mono text-xs">
                    {p.code} <SyntheticBadge show={p.is_synthetic} />
                  </TableCell>
                  <TableCell>{p.nom}</TableCell>
                  <TableCell>{t(`famille.${p.famille}`)}</TableCell>
                  <TableCell className="text-end">
                    <Money value={p.prix_mad} />
                  </TableCell>
                  <TableCell className="text-end">
                    <Money value={p.cout_mad} />
                  </TableCell>
                  <TableCell
                    className={`text-end ${p.marge_mad.startsWith('-') ? 'text-red-700' : ''}`}
                  >
                    <Money value={p.marge_mad} />
                    {p.marge_pct && (
                      <span className="ms-1 text-xs text-muted-foreground">({p.marge_pct} %)</span>
                    )}
                  </TableCell>
                  <TableCell>{t(`niveauQr.${p.niveau_qr}`)}</TableCell>
                  <TableCell>
                    <Switch
                      checked={p.actif}
                      onCheckedChange={() => toggleActif(p)}
                      aria-label={t('produits.actif')}
                    />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditing(p)}
                      aria-label={t('common.edit')}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(p)}
                      aria-label={t('common.delete')}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {editing && (
        <ProduitDialog
          produit={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void refresh();
          }}
        />
      )}
    </>
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

  const err = (name: keyof FormInput) =>
    errors[name]?.message ? String(errors[name]?.message) : undefined;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{produit ? t('produits.edit') : t('produits.new')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void onSubmit(e)} className="grid gap-4 sm:grid-cols-2" noValidate>
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
