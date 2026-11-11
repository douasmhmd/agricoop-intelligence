import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft, Printer } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ApiError } from '@/api/fetcher';
import { useLotsGet, useLotsMouvements, useLotsPerte } from '@/api/generated/lots/lots';
import { qrAdminGenerate } from '@/api/generated/qr-codes/qr-codes';
import { ok } from '@/api/ok';
import {
  DateText,
  ErrorAlert,
  Loading,
  PageHeader,
  StatusBadge,
  SyntheticBadge,
  useErrorMessage,
} from '@/components/common';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { lotTone } from '@/lib/tones';

export const Route = createFileRoute('/lots/$lotId')({
  component: LotPage,
});

/** Downloads a Blob as a file (QR label sheet). */
function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function LotPage() {
  const { lotId } = Route.useParams();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const lotQuery = useLotsGet(lotId);
  const mouvements = useLotsMouvements(lotId);
  const perte = useLotsPerte();
  const [quantite, setQuantite] = useState('');
  const [printing, setPrinting] = useState(false);
  const lot = ok(lotQuery.data);

  const declarePerte = () => {
    const q = Number(quantite);
    if (!Number.isInteger(q) || q < 1) return;
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

  const printLabels = async (regenerer = false) => {
    setPrinting(true);
    try {
      const res = await qrAdminGenerate(lotId, { regenerer: regenerer ? 'true' : 'false' });
      const blob = ok(res) as unknown as Blob;
      download(blob, `qr-${lot?.numero ?? lotId}.pdf`);
      toast.success(t('qr.labelsReady'));
      void queryClient.invalidateQueries();
    } catch (e) {
      const code =
        e instanceof ApiError ? (e.problem as { code?: string } | undefined)?.code : undefined;
      if (code === 'qr_deja_generes' && window.confirm(t('qr.confirmRegenerate'))) {
        await printLabels(true);
        return;
      }
      if (code !== 'qr_deja_generes') toast.error(errorMessage(e));
    } finally {
      setPrinting(false);
    }
  };

  if (lotQuery.isPending) return <Loading />;
  if (lotQuery.error || !lot) return <ErrorAlert error={lotQuery.error} />;

  return (
    <>
      <Link
        to="/lots"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" /> {t('lots.title')}
      </Link>
      <PageHeader
        title={`${t('lots.lot')} ${lot.numero}`}
        description={`${lot.produit_code} — ${lot.produit_nom}`}
        actions={
          <Button onClick={() => void printLabels()} disabled={printing}>
            <Printer className="size-4" /> {t('qr.printLabels')}
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {t('lots.stock')}: <span className="tabular-nums">{lot.stock}</span>
              <StatusBadge tone={lotTone[lot.statut]}>{t(`lotStatut.${lot.statut}`)}</StatusBadge>
              <SyntheticBadge show={lot.is_synthetic} />
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <p>
              {t('lots.fabrication')}: <DateText value={lot.date_fabrication} />
            </p>
            <p>
              {t('lots.peremption')}: <DateText value={lot.date_peremption} />
            </p>
            <p>
              {t('lots.initiale')}: <span className="tabular-nums">{lot.quantite_initiale}</span>
            </p>
            <p>
              {t('produits.niveauQr')}: {t(`niveauQr.${lot.niveau_qr}`)}
            </p>
            <div className="mt-3 grid gap-2 border-t pt-3">
              <span className="font-medium">{t('lots.declarePerte')}</span>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={1}
                  max={lot.stock}
                  value={quantite}
                  onChange={(e) => setQuantite(e.target.value)}
                  aria-label={t('lots.quantite')}
                />
                <Button
                  variant="outline"
                  onClick={declarePerte}
                  disabled={perte.isPending || !quantite}
                >
                  {t('lots.recordPerte')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t('lots.mouvements')}</CardTitle>
          </CardHeader>
          <CardContent>
            {mouvements.isPending ? (
              <Loading />
            ) : mouvements.error ? (
              <ErrorAlert error={mouvements.error} />
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
                  {(ok(mouvements.data) ?? []).map((m) => (
                    <TableRow key={m.mouvement_id}>
                      <TableCell>
                        <DateText value={m.date_mouvement} withTime />
                      </TableCell>
                      <TableCell>{t(`mouvement.${m.type_mouvement}`)}</TableCell>
                      <TableCell
                        className={`text-end tabular-nums ${m.type_mouvement === 'entree' ? 'text-emerald-700' : 'text-red-700'}`}
                      >
                        {m.type_mouvement === 'entree' ? '+' : '−'}
                        {m.quantite}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
