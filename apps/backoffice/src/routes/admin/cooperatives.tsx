import { zodResolver } from '@hookform/resolvers/zod';
import { cooperativeCreateSchema } from '@agricoop/shared';
import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Building2, Check, Plus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { z } from 'zod';
import { useCooperativesAdminCreate, useCooperativesAdminList } from '@/api/generated/admin/admin';
import { ok } from '@/api/ok';
import { useSession } from '@/auth/session';
import {
  DateText,
  EmptyState,
  ErrorAlert,
  Field,
  PageHeader,
  SyntheticBadge,
  useErrorMessage,
} from '@/components/common';
import { DataCard, TableSkeleton } from '@/components/data';
import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
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
} from '@agricoop/ui';
import { usePreferences } from '@/state/preferences';

export const Route = createFileRoute('/admin/cooperatives')({
  component: AdminCooperativesPage,
});

function AdminCooperativesPage() {
  const { t } = useTranslation();
  const session = useSession();
  const prefs = usePreferences();
  const [creating, setCreating] = useState(false);
  const list = useCooperativesAdminList({ query: { enabled: Boolean(session?.isAdmin) } });

  if (!session?.isAdmin)
    return (
      <EmptyState icon={Building2} title={t('admin.title')}>
        {t('auth.adminOnly')}
      </EmptyState>
    );
  const coops = ok(list.data) ?? [];

  return (
    <>
      <PageHeader
        title={t('admin.title')}
        description={t('admin.subtitle')}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus /> {t('admin.new')}
          </Button>
        }
      />
      {list.isPending ? (
        <TableSkeleton columns={5} rows={3} />
      ) : list.error ? (
        <ErrorAlert error={list.error} />
      ) : coops.length === 0 ? (
        <EmptyState icon={Building2} title={t('admin.emptyTitle')}>
          {t('admin.empty')}
        </EmptyState>
      ) : (
        <DataCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin.code')}</TableHead>
                <TableHead>{t('admin.nom')}</TableHead>
                <TableHead>{t('admin.province')}</TableHead>
                <TableHead>{t('admin.createdAt')}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {coops.map((c) => {
                const acting = prefs.adminCoopId === c.coop_id;
                return (
                  <TableRow key={c.coop_id} className={cn(acting && 'bg-accent/50')}>
                    <TableCell className="font-mono text-xs">
                      <span className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{c.code}</span>
                        <SyntheticBadge show={c.is_synthetic} />
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">{c.nom}</TableCell>
                    <TableCell>{c.province}</TableCell>
                    <TableCell className="text-muted-foreground">
                      <DateText value={c.created_at} />
                    </TableCell>
                    <TableCell className="text-end">
                      <Button
                        variant={acting ? 'secondary' : 'outline'}
                        size="sm"
                        onClick={() => prefs.setAdminCoopId(c.coop_id)}
                      >
                        {acting && <Check />}
                        {acting ? t('admin.actingOn') : t('admin.actOn')}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </DataCard>
      )}
      {creating && <CreateDialog onClose={() => setCreating(false)} />}
    </>
  );
}

type FormInput = z.input<typeof cooperativeCreateSchema>;

function CreateDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const create = useCooperativesAdminCreate();
  const form = useForm<FormInput>({ resolver: zodResolver(cooperativeCreateSchema) });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) =>
    create.mutate(
      { data: values },
      {
        onSuccess: () => {
          toast.success(t('admin.created'));
          void queryClient.invalidateQueries();
          onClose();
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    ),
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('admin.new')}</DialogTitle>
          <DialogDescription>{t('admin.newHint')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void onSubmit(e)} className="grid gap-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('admin.code')} error={errors.code?.message}>
              <Input {...form.register('code')} placeholder="COOP03" dir="ltr" />
            </Field>
            <Field label={t('admin.province')} error={errors.province?.message}>
              <Input {...form.register('province')} />
            </Field>
          </div>
          <Field label={t('admin.nom')} error={errors.nom?.message}>
            <Input {...form.register('nom')} />
          </Field>
          <fieldset className="grid gap-4 rounded-xl border bg-muted/30 p-4">
            <legend className="px-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {t('admin.gestionnaire')}
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('admin.prenom')} error={errors.gestionnaire?.prenom?.message}>
                <Input {...form.register('gestionnaire.prenom')} />
              </Field>
              <Field label={t('admin.nomFamille')} error={errors.gestionnaire?.nom?.message}>
                <Input {...form.register('gestionnaire.nom')} />
              </Field>
            </div>
            <Field
              label={t('admin.email')}
              error={errors.gestionnaire?.email?.message}
              hint={t('admin.emailHint')}
            >
              <Input type="email" {...form.register('gestionnaire.email')} dir="ltr" />
            </Field>
          </fieldset>
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
