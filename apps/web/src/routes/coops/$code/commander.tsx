import { zodResolver } from '@hookform/resolvers/zod';
import { coordonneesSchema, lineTotal } from '@agricoop/shared';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Loader2, Lock, ShieldCheck, ShoppingBag, Truck } from 'lucide-react';
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
import { Button, Input, Picture, Textarea } from '@agricoop/ui';
import { CheckoutSteps } from '@/components/CheckoutSteps';
import { Price } from '@/components/Price';
import { photo, productPhoto } from '@/lib/images';

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
      <EmptyState
        icon={<ShoppingBag className="size-7" aria-hidden />}
        className="mx-auto max-w-xl"
      >
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
    <div className="mx-auto max-w-5xl space-y-10">
      <CheckoutSteps current={1} />
      <div>
        <h1 className="font-display text-display-lg font-semibold">{t('checkout.title')}</h1>
        <p className="mt-2 text-muted-foreground">
          {t('cart.from', { coop: cart.coopNom ?? code })}
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <form
          onSubmit={(e) => void onSubmit(e)}
          className="grid h-fit gap-5 rounded-2xl border bg-card p-6 shadow-soft sm:p-8"
          noValidate
        >
          <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
            <Truck className="size-5 text-primary" aria-hidden /> {t('checkout.delivery')}
          </h2>
          {place.error && (
            <div className="grid gap-2">
              <ErrorAlert error={place.error} />
              {manquants.length > 0 && (
                <ul className="text-sm text-destructive">
                  {manquants.map((m) => (
                    <li key={m.produit_id}>
                      {t('checkout.shortage', {
                        nom: nomProduit(m.produit_id),
                        count: m.disponible,
                      })}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <Field label={t('checkout.nom')} error={errors.nom?.message}>
            <Input autoComplete="name" className="h-11" {...form.register('nom')} />
          </Field>
          <Field label={t('checkout.telephone')} error={errors.telephone?.message}>
            <Input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              dir="ltr"
              placeholder="+212 6…"
              className="h-11"
              {...form.register('telephone', { setValueAs: (v: string) => v || undefined })}
            />
          </Field>
          <Field label={t('checkout.adresse')} error={errors.adresse?.message}>
            <Textarea rows={2} autoComplete="street-address" {...form.register('adresse')} />
          </Field>
          <Field label={t('checkout.ville')} error={errors.ville?.message}>
            <Input autoComplete="address-level2" className="h-11" {...form.register('ville')} />
          </Field>
          <p className="flex items-start gap-2 rounded-xl bg-secondary/70 p-3 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            {t('checkout.privacy')}
          </p>
          <Button type="submit" size="xl" shape="pill" variant="gold" disabled={place.isPending}>
            {place.isPending ? (
              <Loader2 className="size-5 animate-spin" aria-hidden />
            ) : (
              <Lock className="size-5" aria-hidden />
            )}
            {t('checkout.pay')} · <Money value={total} />
          </Button>
          <p className="text-center text-xs text-muted-foreground">{t('checkout.redirect')}</p>
        </form>

        <aside className="h-fit rounded-2xl border bg-card p-6 shadow-soft lg:sticky lg:top-28">
          <h2 className="font-display text-lg font-semibold">{t('checkout.summary')}</h2>
          <ul className="mt-4 grid gap-3">
            {cart.lines.map((l) => (
              <li key={l.produit_id} className="flex items-center gap-3 text-sm">
                <Picture
                  {...photo(
                    productPhoto(l.categorie ?? '', l.famille ?? 'alimentaire'),
                    '56px',
                    400,
                  )}
                  alt=""
                  className="size-12 shrink-0 rounded-lg"
                />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2">{l.nom}</span>
                  <span className="text-muted-foreground">× {l.quantite}</span>
                </span>
                <Money value={lineTotal(l.prix_mad, l.quantite)} className="font-medium" />
              </li>
            ))}
          </ul>
          <p className="mt-5 flex items-baseline justify-between border-t pt-4">
            <span className="text-sm text-muted-foreground">{t('cart.total')}</span>
            <Price value={total} className="font-display text-xl font-semibold" />
          </p>
        </aside>
      </div>
    </div>
  );
}
