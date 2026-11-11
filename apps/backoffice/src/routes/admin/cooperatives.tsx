import { zodResolver } from '@hookform/resolvers/zod';
import { cooperativeCreateSchema } from '@agricoop/shared';
import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
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
  ErrorAlert,
  Field,
  Loading,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

  if (!session?.isAdmin) return <p className="text-muted-foreground">{t('auth.adminOnly')}</p>;

  return (
    <>
      <PageHeader
        title={t('admin.title')}
        description={t('admin.subtitle')}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" /> {t('admin.new')}
          </Button>
        }
      />
      {list.isPending ? (
        <Loading />
      ) : list.error ? (
        <ErrorAlert error={list.error} />
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
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
              {(ok(list.data) ?? []).map((c) => (
                <TableRow key={c.coop_id}>
                  <TableCell className="font-mono text-xs">
                    {c.code} <SyntheticBadge show={c.is_synthetic} />
                  </TableCell>
                  <TableCell>{c.nom}</TableCell>
                  <TableCell>{c.province}</TableCell>
                  <TableCell>
                    <DateText value={c.created_at} />
                  </TableCell>
                  <TableCell className="text-end">
                    <Button
                      variant={prefs.adminCoopId === c.coop_id ? 'secondary' : 'outline'}
                      size="sm"
                      onClick={() => prefs.setAdminCoopId(c.coop_id)}
                    >
                      {prefs.adminCoopId === c.coop_id ? t('admin.actingOn') : t('admin.actOn')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
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
          <fieldset className="grid gap-4 rounded-lg border p-3">
            <legend className="px-1 text-sm font-medium">{t('admin.gestionnaire')}</legend>
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
