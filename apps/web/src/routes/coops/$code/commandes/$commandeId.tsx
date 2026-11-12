import { type CommandeStatut, mockPaymentPath } from '@agricoop/shared';
import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { CircleAlert } from 'lucide-react';
import { motion } from 'motion/react';
import { ease } from '@agricoop/ui/motion';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  useBoutiqueCommandesCancel,
  useBoutiqueCommandesGet,
} from '@/api/generated/boutique/boutique';
import { ok } from '@/api/ok';
import { RequireAuth } from '@/auth/RequireAuth';
import { CheckoutSteps, Confetti } from '@/components/CheckoutSteps';
import { DateText, ErrorAlert, Loading, Money, useErrorMessage } from '@/components/common';
import { statutVariant } from '@/lib/ui';
import { Badge, Button } from '@agricoop/ui';

export const Route = createFileRoute('/coops/$code/commandes/$commandeId')({
  // ?paiement=ok|refuse when coming back from the payment page.
  validateSearch: z.object({ paiement: z.enum(['ok', 'refuse']).optional() }),
  component: () => (
    <RequireAuth>
      <OrderPage />
    </RequireAuth>
  ),
});

const STEPS: CommandeStatut[] = ['creee', 'payee', 'expediee', 'livree'];

function OrderPage() {
  const { code, commandeId } = Route.useParams();
  const { paiement } = Route.useSearch();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const query = useBoutiqueCommandesGet(code, commandeId);
  const cancel = useBoutiqueCommandesCancel();
  const commande = ok(query.data);

  if (query.isPending) return <Loading />;
  if (query.error || !commande) return <ErrorAlert error={query.error} />;

  const step = STEPS.indexOf(commande.statut);
  const onCancel = () => {
    if (!window.confirm(t('order.confirmCancel'))) return;
    cancel.mutate(
      { code, commandeId },
      {
        onSuccess: () => {
          toast.success(t('order.cancelled'));
          void queryClient.invalidateQueries();
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  };

  const paid = paiement === 'ok' && commande.statut !== 'creee';
  const notPaid = paiement === 'refuse' || (paiement === 'ok' && commande.statut === 'creee');

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <CheckoutSteps current={commande.statut === 'creee' ? 2 : 4} />

      {paid && (
        <div
          className="relative overflow-hidden rounded-2xl border border-success/25 bg-success/8 p-6 text-center"
          role="status"
        >
          <Confetti />
          <svg viewBox="0 0 48 48" className="mx-auto size-14" aria-hidden>
            <circle cx="24" cy="24" r="22" className="fill-success" />
            <motion.path
              d="M14 24.5l7 7 13-14"
              fill="none"
              stroke="white"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.5, delay: 0.2, ease: ease.out }}
            />
          </svg>
          <p className="mt-3 font-display text-xl font-semibold text-success">{t('order.paid')}</p>
        </div>
      )}
      {notPaid && (
        <div
          className="flex items-center gap-3 rounded-2xl border border-warning/50 bg-warning/15 p-4 text-warning-foreground dark:text-warning"
          role="status"
        >
          <CircleAlert className="size-5 shrink-0" /> {t('order.notPaid')}
        </div>
      )}

      <section className="rounded-2xl border bg-card p-6 shadow-soft sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-display-sm font-semibold">
              {t('order.title')}{' '}
              <span className="font-mono text-lg tracking-wide text-muted-foreground" dir="ltr">
                {commande.commande_id.slice(0, 8).toUpperCase()}
              </span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              <DateText value={commande.date_commande} withTime />
            </p>
          </div>
          <Badge variant={statutVariant[commande.statut]} dot>
            {t(`statut.${commande.statut}`)}
          </Badge>
        </div>

        {commande.statut !== 'annulee' && (
          <ol
            className="mt-8 grid grid-cols-4 gap-2 text-center text-xs"
            aria-label={t('order.progress')}
          >
            {STEPS.map((st, i) => (
              <li key={st} aria-current={i === step ? 'step' : undefined}>
                <div className="relative mb-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className="absolute inset-0 origin-left rounded-full bg-primary rtl:origin-right"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: i <= step ? 1 : 0 }}
                    transition={{ duration: 0.5, delay: 0.1 + i * 0.12, ease: ease.out }}
                  />
                </div>
                <span className={i <= step ? 'font-medium' : 'text-muted-foreground'}>
                  {t(`statut.${st}`)}
                </span>
              </li>
            ))}
          </ol>
        )}

        <ul className="mt-8 grid gap-3 text-sm">
          {commande.lignes.map((l) => (
            <li key={l.ligne_id} className="flex justify-between gap-3 border-b pb-3 last:border-0">
              <span>
                {l.produit_nom} <span className="text-muted-foreground">× {l.quantite}</span>
              </span>
              <Money value={l.montant_mad} />
            </li>
          ))}
        </ul>
        <p className="mt-4 flex items-baseline justify-between border-t pt-4">
          <span className="text-sm text-muted-foreground">{t('cart.total')}</span>
          <Money
            value={commande.montant_total_mad}
            className="font-display text-xl font-semibold"
          />
        </p>
      </section>

      <div className="grid gap-3 sm:flex sm:flex-wrap sm:items-center">
        {commande.statut === 'creee' && (
          <Button asChild size="xl" shape="pill" variant="gold">
            <a href={mockPaymentPath(code, commandeId)}>{t('order.payNow')}</a>
          </Button>
        )}
        {(commande.statut === 'creee' || commande.statut === 'payee') && (
          <Button
            variant="outline"
            shape="pill"
            size="lg"
            onClick={onCancel}
            disabled={cancel.isPending}
          >
            {t('order.cancel')}
          </Button>
        )}
        <Link to="/compte" className="text-center text-sm text-primary underline sm:ms-auto">
          {t('order.allOrders')}
        </Link>
      </div>
    </div>
  );
}
