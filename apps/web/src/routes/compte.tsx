import { createFileRoute, Link } from '@tanstack/react-router';
import { ChevronRight, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from 'react-oidc-context';
import { useBoutiqueCommandesMine } from '@/api/generated/boutique/boutique';
import { useStorefrontList } from '@/api/generated/storefront/storefront';
import { ok } from '@/api/ok';
import { RequireAuth } from '@/auth/RequireAuth';
import { DateText, Loading, Money } from '@/components/common';
import { Badge, Button } from '@agricoop/ui';

export const Route = createFileRoute('/compte')({
  component: () => (
    <RequireAuth>
      <AccountPage />
    </RequireAuth>
  ),
});

function AccountPage() {
  const { t } = useTranslation();
  const auth = useAuth();
  const coops = useStorefrontList();
  const profile = auth.user?.profile;

  return (
    <>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('account.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {profile?.given_name ?? profile?.preferred_username}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void auth.signoutRedirect()}>
          <LogOut className="size-4 rtl:rotate-180" /> {t('auth.signOut')}
        </Button>
      </div>
      <h2 className="mb-3 font-semibold">{t('account.orders')}</h2>
      {coops.isPending ? (
        <Loading />
      ) : (
        <div className="grid gap-4">
          {(ok(coops.data) ?? []).map((c) => (
            <CoopOrders key={c.code} code={c.code} nom={c.nom} />
          ))}
          <p className="text-center text-sm text-muted-foreground">{t('account.onlyWithOrders')}</p>
        </div>
      )}
    </>
  );
}

/** Orders are kept per cooperative (one customer record per cooperative). */
function CoopOrders({ code, nom }: { code: string; nom: string }) {
  const { t } = useTranslation();
  const orders = ok(useBoutiqueCommandesMine(code).data) ?? [];
  if (orders.length === 0) return null;
  return (
    <section>
      <h3 className="mb-2 text-sm font-medium text-muted-foreground">{nom}</h3>
      <ul className="grid gap-2">
        {orders.map((o) => (
          <li key={o.commande_id}>
            <Link
              to="/coops/$code/commandes/$commandeId"
              params={{ code, commandeId: o.commande_id }}
              className="flex items-center gap-3 rounded-xl border bg-card p-3 hover:bg-accent"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <DateText value={o.date_commande} />
                </p>
                <Money value={o.montant_total_mad} className="font-medium" />
              </div>
              <Badge variant="secondary">{t(`statut.${o.statut}`)}</Badge>
              <ChevronRight className="size-4 text-muted-foreground rtl:rotate-180" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
