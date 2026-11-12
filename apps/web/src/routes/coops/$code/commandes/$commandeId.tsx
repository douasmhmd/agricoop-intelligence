import { type CommandeStatut, mockPaymentPath } from '@agricoop/shared';
import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { CheckCircle2, CircleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  useBoutiqueCommandesCancel,
  useBoutiqueCommandesGet,
} from '@/api/generated/boutique/boutique';
import { ok } from '@/api/ok';
import { RequireAuth } from '@/auth/RequireAuth';
import { DateText, ErrorAlert, Loading, Money, useErrorMessage } from '@/components/common';
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

  return (
    <div className="mx-auto max-w-xl">
      {paiement === 'ok' && commande.statut !== 'creee' && (
        <div
          className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 p-4 text-emerald-900"
          role="status"
        >
          <CheckCircle2 className="size-5 shrink-0" /> {t('order.paid')}
        </div>
      )}
      {(paiement === 'refuse' || (paiement === 'ok' && commande.statut === 'creee')) && (
        <div
          className="mb-4 flex items-center gap-2 rounded-xl bg-amber-50 p-4 text-amber-900"
          role="status"
        >
          <CircleAlert className="size-5 shrink-0" /> {t('order.notPaid')}
        </div>
      )}

      <h1 className="text-2xl font-bold">
        {t('order.title')} {commande.commande_id.slice(0, 8).toUpperCase()}
      </h1>
      <p className="mb-4 text-sm text-muted-foreground">
        <DateText value={commande.date_commande} withTime />
      </p>

      {commande.statut === 'annulee' ? (
        <Badge variant="outline" className="mb-4">
          {t('statut.annulee')}
        </Badge>
      ) : (
        <ol
          className="mb-5 grid grid-cols-4 gap-1 text-center text-xs"
          aria-label={t('order.progress')}
        >
          {STEPS.map((s, i) => (
            <li key={s} aria-current={i === step ? 'step' : undefined}>
              <div className={`mb-1 h-1.5 rounded-full ${i <= step ? 'bg-primary' : 'bg-muted'}`} />
              <span className={i <= step ? 'font-medium' : 'text-muted-foreground'}>
                {t(`statut.${s}`)}
              </span>
            </li>
          ))}
        </ol>
      )}

      <section className="rounded-xl border bg-card p-4">
        <ul className="grid gap-2 text-sm">
          {commande.lignes.map((l) => (
            <li key={l.ligne_id} className="flex justify-between gap-2">
              <span>
                {l.produit_nom} × {l.quantite}
              </span>
              <Money value={l.montant_mad} />
            </li>
          ))}
        </ul>
        <p className="mt-3 flex justify-between border-t pt-3 font-semibold">
          <span>{t('cart.total')}</span> <Money value={commande.montant_total_mad} />
        </p>
      </section>

      <div className="mt-5 grid gap-2">
        {commande.statut === 'creee' && (
          <Button asChild size="lg">
            <a href={mockPaymentPath(code, commandeId)}>{t('order.payNow')}</a>
          </Button>
        )}
        {(commande.statut === 'creee' || commande.statut === 'payee') && (
          <Button variant="outline" onClick={onCancel} disabled={cancel.isPending}>
            {t('order.cancel')}
          </Button>
        )}
        <Link to="/compte" className="text-center text-sm text-primary underline">
          {t('order.allOrders')}
        </Link>
      </div>
    </div>
  );
}
