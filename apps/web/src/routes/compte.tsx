import { createFileRoute, Link } from '@tanstack/react-router';
import { ChevronRight, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from 'react-oidc-context';
import { useBoutiqueCommandesMine } from '@/api/generated/boutique/boutique';
import { useStorefrontList } from '@/api/generated/storefront/storefront';
import { ok } from '@/api/ok';
import { RequireAuth } from '@/auth/RequireAuth';
import { DateText, Loading, Money } from '@/components/common';
import { Badge, Button, ZelligeBackdrop } from '@agricoop/ui';
import { statutVariant } from '@/lib/ui';

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

  const name = profile?.given_name ?? profile?.preferred_username ?? '';
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="grain relative isolate flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-3xl border bg-card p-6 shadow-soft sm:p-8">
        <ZelligeBackdrop className="-z-10" />
        <div className="flex items-center gap-4">
          <span
            aria-hidden
            className="grid size-14 place-items-center rounded-t-full rounded-b-xl bg-primary font-display text-2xl font-semibold text-primary-foreground"
          >
            {name.charAt(0).toUpperCase() || '·'}
          </span>
          <div>
            <h1 className="font-display text-display-sm font-semibold">{t('account.title')}</h1>
            {name && <p className="text-muted-foreground">{t('account.hello', { name })}</p>}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          shape="pill"
          onClick={() => void auth.signoutRedirect()}
        >
          <LogOut className="size-4 rtl:rotate-180" /> {t('auth.signOut')}
        </Button>
      </header>
      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold">{t('account.orders')}</h2>
        {coops.isPending ? (
          <Loading />
        ) : (
          <div className="grid gap-6">
            {(ok(coops.data) ?? []).map((c) => (
              <CoopOrders key={c.code} code={c.code} nom={c.nom} />
            ))}
            <p className="text-center text-sm text-muted-foreground">
              {t('account.onlyWithOrders')}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

/** Orders are kept per cooperative (one customer record per cooperative). */
function CoopOrders({ code, nom }: { code: string; nom: string }) {
  const { t } = useTranslation();
  const orders = ok(useBoutiqueCommandesMine(code).data) ?? [];
  if (orders.length === 0) return null;
  return (
    <section>
      <h3 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        {nom}
      </h3>
      <ul className="grid gap-2">
        {orders.map((o) => (
          <li key={o.commande_id}>
            <Link
              to="/coops/$code/commandes/$commandeId"
              params={{ code, commandeId: o.commande_id }}
              className="group flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-soft transition-[box-shadow,transform] duration-300 ease-out-expo hover:-translate-y-0.5 hover:shadow-lifted"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <DateText value={o.date_commande} />
                </p>
                <Money value={o.montant_total_mad} className="font-medium" />
              </div>
              <Badge variant={statutVariant[o.statut]} dot>
                {t(`statut.${o.statut}`)}
              </Badge>
              <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
