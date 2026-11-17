import { daysBetween, isoDateInZone } from '@agricoop/shared';
import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
  Input,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@agricoop/ui';
import { fadeUp, stagger, transition } from '@agricoop/ui/motion';
import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { ArrowDownLeft, ArrowUpRight, Printer, QrCode, TrendingDown } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useLotsGet, useLotsMouvements, useLotsPerte } from '@/api/generated/lots/lots';
import { ok } from '@/api/ok';
import {
  DateText,
  ErrorAlert,
  Field,
  PageHeader,
  StatusBadge,
  SyntheticBadge,
  useErrorMessage,
} from '@/components/common';
import { BackLink, DetailItem, ExpiryBar, TableSkeleton } from '@/components/data';
import { useConfirm } from '@/components/confirm';
import { lotTone } from '@/lib/tones';
import { usePrintLabels } from '@/lots/labels';

export const Route = createFileRoute('/lots/$lotId')({
  component: LotPage,
});

const MOUVEMENT = {
  entree: { variant: 'success', icon: ArrowDownLeft, sign: '+', text: 'text-success' },
  sortie: { variant: 'info', icon: ArrowUpRight, sign: '−', text: 'text-foreground' },
  perte: { variant: 'destructive', icon: TrendingDown, sign: '−', text: 'text-destructive' },
} as const;

function LotPage() {
  const { lotId } = Route.useParams();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const lotQuery = useLotsGet(lotId);
  const mouvements = useLotsMouvements(lotId);
  const perte = useLotsPerte();
  const [quantite, setQuantite] = useState('');
  const [confirm, confirmDialog] = useConfirm();
  const labels = usePrintLabels(confirm);
  const lot = ok(lotQuery.data);

  const q = Number(quantite);
  const perteError =
    quantite && lot && (!Number.isInteger(q) || q < 1 || q > lot.stock)
      ? t('lots.perteInvalid', { max: lot.stock })
      : undefined;

  const declarePerte = () => {
    if (!quantite || perteError) return;
    perte.mutate(
      { lotId, data: { quantite: q } },
      {
        onSuccess: () => {
          toast.success(t('lots.perteRecorded'));
          setQuantite('');
          void queryClient.invalidateQueries();
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  };

  if (lotQuery.isPending)
    return (
      <div className="grid gap-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl lg:col-span-2" />
        </div>
      </div>
    );
  if (lotQuery.error || !lot) return <ErrorAlert error={lotQuery.error} />;

  const restant = lot.quantite_initiale > 0 ? lot.stock / lot.quantite_initiale : 0;
  const jours = daysBetween(isoDateInZone(new Date()), lot.date_peremption);
  const rows = ok(mouvements.data) ?? [];

  return (
    <>
      <BackLink to="/lots">{t('lots.title')}</BackLink>
      <PageHeader
        title={`${t('lots.lot')} ${lot.numero}`}
        description={`${lot.produit_code} — ${lot.produit_nom}`}
        actions={
          <Button
            onClick={() => void labels.print(lot.lot_id, lot.numero)}
            disabled={labels.printing !== null}
          >
            <Printer /> {t('qr.printLabels')}
          </Button>
        }
      />
      <div className="-mt-3 mb-6 flex flex-wrap items-center gap-2">
        <StatusBadge tone={lotTone[lot.statut]}>{t(`lotStatut.${lot.statut}`)}</StatusBadge>
        <Badge variant="outline">
          <QrCode aria-hidden /> {t(`niveauQr.${lot.niveau_qr}`)}
        </Badge>
        <SyntheticBadge show={lot.is_synthetic} />
      </div>

      <motion.div
        variants={stagger(0.06)}
        initial="hidden"
        animate="visible"
        className="grid gap-4 lg:grid-cols-3"
      >
        <motion.div variants={fadeUp} className="grid content-start gap-4">
          <Card className="gap-5 px-5 py-5">
            <div className="grid gap-1">
              <p className="text-sm text-muted-foreground">{t('lots.stock')}</p>
              <p className="font-display text-4xl leading-none font-semibold tabular-nums">
                {lot.stock}
                <span className="ms-1.5 font-sans text-base font-normal text-muted-foreground">
                  / {lot.quantite_initiale}
                </span>
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <motion.div
                  className="h-full origin-left rounded-full bg-primary rtl:origin-right"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: restant > 0 ? Math.max(restant, 0.02) : 0 }}
                  transition={transition.reveal}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {t('lots.restant', { pct: Math.round(restant * 100) })}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-4 border-t pt-4">
              <DetailItem label={t('lots.fabrication')}>
                <DateText value={lot.date_fabrication} />
              </DetailItem>
              <DetailItem label={t('lots.peremption')}>
                <DateText value={lot.date_peremption} />
              </DetailItem>
              {lot.statut === 'disponible' && (
                <div className="col-span-2">
                  <ExpiryBar jours={jours} />
                </div>
              )}
            </dl>
          </Card>

          <Card className="gap-4 px-5 py-5">
            <div className="grid gap-1">
              <CardTitle className="text-base">{t('lots.declarePerte')}</CardTitle>
              <CardDescription>{t('lots.perteHint')}</CardDescription>
            </div>
            <form
              className="flex items-start gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                declarePerte();
              }}
              noValidate
            >
              <div className="flex-1">
                <Field label={t('lots.quantite')} error={perteError}>
                  <Input
                    type="number"
                    min={1}
                    max={lot.stock}
                    value={quantite}
                    onChange={(e) => setQuantite(e.target.value)}
                    disabled={lot.stock === 0}
                  />
                </Field>
              </div>
              <Button
                type="submit"
                variant="outline"
                className="mt-[1.625rem]"
                disabled={perte.isPending || !quantite || Boolean(perteError)}
              >
                {t('lots.recordPerte')}
              </Button>
            </form>
          </Card>
        </motion.div>

        <motion.div variants={fadeUp} className="min-w-0 lg:col-span-2">
          <Card className="gap-0 py-0">
            <CardHeader className="border-b px-5 py-4">
              <CardTitle className="text-base">{t('lots.mouvements')}</CardTitle>
              <CardDescription>{t('lots.mouvementsHint')}</CardDescription>
            </CardHeader>
            {mouvements.isPending ? (
              <div className="p-3">
                <TableSkeleton columns={3} rows={3} />
              </div>
            ) : mouvements.error ? (
              <div className="p-5">
                <ErrorAlert error={mouvements.error} />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('lots.date')}</TableHead>
                    <TableHead>{t('lots.type')}</TableHead>
                    <TableHead className="text-end">{t('lots.quantite')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((m) => {
                    const style = MOUVEMENT[m.type_mouvement];
                    const Icon = style.icon;
                    return (
                      <TableRow key={m.mouvement_id}>
                        <TableCell className="text-muted-foreground">
                          <DateText value={m.date_mouvement} withTime />
                        </TableCell>
                        <TableCell>
                          <Badge variant={style.variant}>
                            <Icon aria-hidden />
                            {t(`mouvement.${m.type_mouvement}`)}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className={cn('text-end font-semibold tabular-nums', style.text)}
                        >
                          {/* Sign before the number in Arabic too. */}
                          <span dir="ltr">
                            {style.sign}
                            {m.quantite}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Card>
        </motion.div>
      </motion.div>
      {confirmDialog}
    </>
  );
}
