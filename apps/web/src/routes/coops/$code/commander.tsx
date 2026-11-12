import { zodResolver } from '@hookform/resolvers/zod';
import { coordonneesSchema } from '@agricoop/shared';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Lock } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useAuth } from 'react-oidc-context';
import type { z } from 'zod';
import { ApiError } from '@/api/fetcher';
import { useBoutiqueCommandesPlace } from '@/api/generated/boutique/boutique';
import { ok } from '@/api/ok';
import { RequireAuth } from '@/auth/RequireAuth';
import { useCart } from '@/cart/cart';
import { EmptyState, ErrorAlert, Field, Money } from '@/components/common';
import { Button, Input, Textarea } from '@agricoop/ui';

export const Route = createFileRoute('/coops/$code/commander')({
  component: () => (
    <RequireAuth>
      <CheckoutPage />
    </RequireAuth>
  ),
});

type Coordonnees = z.input<typeof coordonneesSchema>;
interface Manquant {
  produit_id: string;
  demande: number;
  disponible: number;
}

function CheckoutPage() {
  const { code } = Route.useParams();
  const { t } = useTranslation();
  const auth = useAuth();
  const { cart, total, clear } = useCart();
  const place = useBoutiqueCommandesPlace();
  const [manquants, setManquants] = useState<Manquant[]>([]);
  const profile = auth.user?.profile;
  const form = useForm<Coordonnees>({
    resolver: zodResolver(coordonneesSchema),
    defaultValues: { nom: [profile?.given_name, profile?.family_name].filter(Boolean).join(' ') },
  });
  const { errors } = form.formState;

  if (cart.coopCode !== code || cart.lines.length === 0) {
    return (
      <EmptyState>
        <p>{t('cart.empty')}</p>
        <Link to="/coops/$code" params={{ code }} className="text-primary underline">
          {t('cart.browse')}
        </Link>
      </EmptyState>
    );
  }

  const onSubmit = form.handleSubmit((coordonnees) => {
    setManquants([]);
    place.mutate(
      {
        code,
        data: {
          lignes: cart.lines.map((l) => ({ produit_id: l.produit_id, quantite: l.quantite })),
          coordonnees: coordonneesSchema.parse(coordonnees),
        },
      },
      {
        onSuccess: (res) => {
          const commande = ok(res);
          if (!commande) return;
          clear();
          // Hosted payment page (CMI-style mock), same origin.
          window.location.assign(commande.paiement.redirect_url);
        },
        onError: (error) => {
          if (
            error instanceof ApiError &&
            Array.isArray((error.problem as { manquants?: unknown })?.manquants)
          ) {
            setManquants((error.problem as unknown as { manquants: Manquant[] }).manquants);
          }
        },
      },
    );
  });

  const nomProduit = (id: string) => cart.lines.find((l) => l.produit_id === id)?.nom ?? id;

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-1 text-2xl font-bold">{t('checkout.title')}</h1>
      <p className="mb-5 text-sm text-muted-foreground">
        {t('cart.from', { coop: cart.coopNom ?? code })}
      </p>

      <section className="mb-5 rounded-xl border bg-card p-4">
        <ul className="grid gap-1 text-sm">
          {cart.lines.map((l) => (
            <li key={l.produit_id} className="flex justify-between gap-2">
              <span>
                {l.nom} × {l.quantite}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 flex justify-between border-t pt-3 font-semibold">
          <span>{t('cart.total')}</span> <Money value={total} />
        </p>
      </section>

      {place.error && (
        <div className="mb-4 grid gap-2">
          <ErrorAlert error={place.error} />
          {manquants.length > 0 && (
            <ul className="text-sm text-red-900">
              {manquants.map((m) => (
                <li key={m.produit_id}>
                  {t('checkout.shortage', { nom: nomProduit(m.produit_id), count: m.disponible })}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <form onSubmit={(e) => void onSubmit(e)} className="grid gap-4" noValidate>
        <h2 className="font-semibold">{t('checkout.delivery')}</h2>
        <Field label={t('checkout.nom')} error={errors.nom?.message}>
          <Input autoComplete="name" {...form.register('nom')} />
        </Field>
        <Field label={t('checkout.telephone')} error={errors.telephone?.message}>
          <Input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            dir="ltr"
            placeholder="+212 6…"
            {...form.register('telephone', { setValueAs: (v: string) => v || undefined })}
          />
        </Field>
        <Field label={t('checkout.adresse')} error={errors.adresse?.message}>
          <Textarea rows={2} autoComplete="street-address" {...form.register('adresse')} />
        </Field>
        <Field label={t('checkout.ville')} error={errors.ville?.message}>
          <Input autoComplete="address-level2" {...form.register('ville')} />
        </Field>
        <p className="text-xs text-muted-foreground">{t('checkout.privacy')}</p>
        <Button type="submit" size="lg" disabled={place.isPending}>
          <Lock className="size-4" /> {t('checkout.pay')} · <Money value={total} />
        </Button>
      </form>
    </div>
  );
}
