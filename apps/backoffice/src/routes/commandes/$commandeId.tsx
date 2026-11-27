import { COMMANDE_TRANSITIONS, type CommandeStatut } from '@agricoop/shared';
import {
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@agricoop/ui';
import { fadeUp, stagger, transition } from '@agricoop/ui/motion';
import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import {
  Ban,
  Check,
  CircleCheck,
  CreditCard,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Truck,
  User,
} from 'lucide-react';
import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useCommandesChangeStatut, useCommandesGet } from '@/api/generated/commandes/commandes';
import { ok } from '@/api/ok';
import {
  DateText,
  ErrorAlert,
  Money,
  PageHeader,
  StatusBadge,
  SyntheticBadge,
  useErrorMessage,
} from '@/components/common';
import { BackLink } from '@/components/data';
import { useConfirm } from '@/components/confirm';
import { commandeTone } from '@/lib/tones';

export const Route = createFileRoute('/commandes/$commandeId')({
  component: CommandePage,
});

type Next = 'payee' | 'expediee' | 'livree' | 'annulee';
const ACTION_ICON = { payee: CreditCard, expediee: Truck, livree: CircleCheck, annulee: Ban };
const STEPS = ['creee', 'payee', 'expediee', 'livree'] as const;

function CommandePage() {
  const { commandeId } = Route.useParams();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const [confirm, confirmDialog] = useConfirm();
  const query = useCommandesGet(commandeId);
  const change = useCommandesChangeStatut();
  const commande = ok(query.data);

  if (query.isPending)
    return (
      <div className="grid gap-4">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-20 rounded-xl" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-64 rounded-xl lg:col-span-2" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  if (query.error || !commande) return <ErrorAlert error={query.error} />;

  const next = COMMANDE_TRANSITIONS[commande.statut].filter((s): s is Next => s !== 'creee');

  const setStatut = async (statut: Next) => {
    if (
      statut === 'annulee' &&
      !(await confirm({
        title: t('commandes.cancelTitle'),
        description: t('commandes.confirmCancel'),
        confirmLabel: t('commandes.action.annulee'),
        destructive: true,
      }))
    )
      return;
    change.mutate(
      { commandeId, data: { statut } },
      {
        onSuccess: () => {
          toast.success(t('commandes.updated'));
          void queryClient.invalidateQueries();
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  };

  const client = commande.client;

  return (
    <>
      <BackLink to="/commandes">{t('commandes.title')}</BackLink>
      <PageHeader
        title={`${t('commandes.commande')} ${commande.commande_id.slice(0, 8).toUpperCase()}`}
        description={`${t(`canal.${commande.canal}`)} · ${commande.client.ville}`}
        actions={next.map((s) => {
          const Icon = ACTION_ICON[s];
          return (
            <Button
              key={s}
              variant={s === 'annulee' ? 'outline' : 'default'}
              className={cn(s === 'annulee' && 'text-destructive hover:text-destructive')}
              disabled={change.isPending}
              onClick={() => void setStatut(s)}
            >
              <Icon /> {t(`commandes.action.${s}`)}
            </Button>
          );
        })}
      />

      <motion.div
        variants={stagger(0.06)}
        initial="hidden"
        animate="visible"
        className="grid gap-4"
      >
        <motion.div variants={fadeUp}>
          <Card className="px-5 py-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <StatusBadge tone={commandeTone[commande.statut]}>
                  {t(`statut.${commande.statut}`)}
                </StatusBadge>
                <DateText value={commande.date_commande} withTime />
                <SyntheticBadge show={commande.is_synthetic} />
              </div>
              <p className="font-display text-2xl font-semibold">
                <Money value={commande.montant_total_mad} />
              </p>
            </div>
            <StatusTimeline statut={commande.statut} />
          </Card>
        </motion.div>

        <div className="grid gap-4 lg:grid-cols-3">
          <motion.div variants={fadeUp} className="min-w-0 lg:col-span-2">
            <Card className="gap-0 py-0">
              <CardHeader className="border-b px-5 py-4">
                <CardTitle className="text-base">{t('commandes.lignesTitle')}</CardTitle>
                <CardDescription>{t('commandes.lignesHint')}</CardDescription>
              </CardHeader>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('lots.produit')}</TableHead>
                    <TableHead>{t('lots.lot')}</TableHead>
                    <TableHead className="text-end">{t('lots.quantite')}</TableHead>
                    <TableHead className="text-end">{t('commandes.prixUnitaire')}</TableHead>
                    <TableHead className="text-end">{t('commandes.montant')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commande.lignes.map((l) => (
                    <TableRow key={l.ligne_id}>
                      <TableCell className="font-medium">{l.produit_nom}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {l.lot_id ? (
                          <Link
                            to="/lots/$lotId"
                            params={{ lotId: l.lot_id }}
                            className="hover:text-primary hover:underline"
                          >
                            {l.lot_numero}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">{l.quantite}</TableCell>
                      <TableCell className="text-end text-muted-foreground">
                        <Money value={l.prix_unitaire_mad} />
                      </TableCell>
                      <TableCell className="text-end font-medium">
                        <Money value={l.montant_mad} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={4} className="text-end font-medium">
                      {t('commandes.total')}
                    </TableCell>
                    <TableCell className="text-end font-semibold">
                      <Money value={commande.montant_total_mad} />
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </Card>
          </motion.div>

          <motion.div variants={fadeUp}>
            <Card className="h-full gap-4 px-5 py-5">
              <CardTitle className="text-base">{t('commandes.client')}</CardTitle>
              <ul className="grid gap-3 text-sm">
                <ClientLine icon={User}>
                  <span className="font-medium">{client.nom ?? '—'}</span>
                  <span className="block text-xs text-muted-foreground">
                    {t(`typeClient.${client.type_client}`)}
                  </span>
                </ClientLine>
                {client.telephone && (
                  <ClientLine icon={Phone}>
                    <span dir="ltr">{client.telephone}</span>
                  </ClientLine>
                )}
                {client.email && (
                  <ClientLine icon={Mail}>
                    <span dir="ltr" className="break-all">
                      {client.email}
                    </span>
                  </ClientLine>
                )}
                <ClientLine icon={MapPin}>
                  {client.adresse && <span className="block">{client.adresse}</span>}
                  <span>{client.ville}</span>
                </ClientLine>
              </ul>
              <p className="mt-auto flex items-start gap-1.5 border-t pt-3 text-xs text-muted-foreground">
                <ShieldCheck className="mt-px size-3.5 shrink-0" aria-hidden />
                {t('commandes.piiNotice')}
              </p>
            </Card>
          </motion.div>
        </div>
      </motion.div>
      {confirmDialog}
    </>
  );
}

function ClientLine({ icon: Icon, children }: { icon: typeof User; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-primary">
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 pt-1.5">{children}</span>
    </li>
  );
}

/** Créée → Payée → Expédiée → Livrée, or the cancelled state. */
function StatusTimeline({ statut }: { statut: CommandeStatut }) {
  const { t } = useTranslation();
  if (statut === 'annulee') {
    return (
      <p className="mt-4 flex items-center gap-2 rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        <Ban className="size-4" aria-hidden /> {t('commandes.cancelledNotice')}
      </p>
    );
  }
  const current = STEPS.indexOf(statut);
  return (
    <ol className="mt-5 grid grid-cols-4 gap-2" aria-label={t('commandes.progress')}>
      {STEPS.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s} className="grid gap-2" aria-current={active ? 'step' : undefined}>
            <div className="relative h-1 overflow-hidden rounded-full bg-muted">
              <motion.div
                className="absolute inset-0 origin-left rounded-full bg-primary rtl:origin-right"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: done || active ? 1 : 0 }}
                transition={{ ...transition.reveal, delay: i * 0.12 }}
              />
            </div>
            <span
              className={cn(
                'flex items-center gap-1.5 text-xs',
                active ? 'font-semibold text-foreground' : 'text-muted-foreground',
              )}
            >
              {done && <Check className="size-3.5 text-primary" aria-hidden />}
              {t(`statut.${s}`)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
