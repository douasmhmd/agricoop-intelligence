import { COMMANDE_TRANSITIONS } from '@agricoop/shared';
import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useCommandesChangeStatut, useCommandesGet } from '@/api/generated/commandes/commandes';
import { ok } from '@/api/ok';
import {
  DateText,
  ErrorAlert,
  Loading,
  Money,
  PageHeader,
  StatusBadge,
  SyntheticBadge,
  useErrorMessage,
} from '@/components/common';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { commandeTone } from '@/lib/tones';

export const Route = createFileRoute('/commandes/$commandeId')({
  component: CommandePage,
});

function CommandePage() {
  const { commandeId } = Route.useParams();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const query = useCommandesGet(commandeId);
  const change = useCommandesChangeStatut();
  const commande = ok(query.data);

  if (query.isPending) return <Loading />;
  if (query.error || !commande) return <ErrorAlert error={query.error} />;

  const next = COMMANDE_TRANSITIONS[commande.statut].filter(
    (s): s is 'payee' | 'expediee' | 'livree' | 'annulee' => s !== 'creee',
  );

  const setStatut = (statut: (typeof next)[number]) => {
    if (statut === 'annulee' && !window.confirm(t('commandes.confirmCancel'))) return;
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

  return (
    <>
      <Link
        to="/commandes"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" /> {t('commandes.title')}
      </Link>
      <PageHeader
        title={`${t('commandes.commande')} ${commande.commande_id.slice(0, 8).toUpperCase()}`}
        actions={next.map((s) => (
          <Button
            key={s}
            variant={s === 'annulee' ? 'outline' : 'default'}
            disabled={change.isPending}
            onClick={() => setStatut(s)}
          >
            {t(`commandes.action.${s}`)}
          </Button>
        ))}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={commandeTone[commande.statut]}>
                {t(`statut.${commande.statut}`)}
              </StatusBadge>
              <span className="text-sm font-normal text-muted-foreground">
                {t(`canal.${commande.canal}`)} ·{' '}
                <DateText value={commande.date_commande} withTime />
              </span>
              <SyntheticBadge show={commande.is_synthetic} />
            </CardTitle>
          </CardHeader>
          <CardContent>
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
                    <TableCell>{l.produit_nom}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {l.lot_id ? (
                        <Link
                          to="/lots/$lotId"
                          params={{ lotId: l.lot_id }}
                          className="hover:underline"
                        >
                          {l.lot_numero}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">{l.quantite}</TableCell>
                    <TableCell className="text-end">
                      <Money value={l.prix_unitaire_mad} />
                    </TableCell>
                    <TableCell className="text-end">
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('commandes.client')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-1 text-sm">
            <p className="font-medium">{commande.client.nom ?? '—'}</p>
            <p>{t(`typeClient.${commande.client.type_client}`)}</p>
            {commande.client.telephone && (
              <p dir="ltr" className="text-start">
                {commande.client.telephone}
              </p>
            )}
            {commande.client.email && (
              <p dir="ltr" className="text-start">
                {commande.client.email}
              </p>
            )}
            {commande.client.adresse && <p>{commande.client.adresse}</p>}
            <p>{commande.client.ville}</p>
            <p className="mt-3 text-xs text-muted-foreground">{t('commandes.piiNotice')}</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
