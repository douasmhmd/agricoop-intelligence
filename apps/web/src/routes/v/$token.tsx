import type { Verification } from '@agricoop/shared';
import { createFileRoute, Link } from '@tanstack/react-router';
import { BadgeCheck, ShieldAlert, ShieldX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '@/api/fetcher';
import { useVerificationVerify } from '@/api/generated/verification/verification';
import { ok } from '@/api/ok';
import { DateText, ErrorAlert, Loading } from '@/components/common';

export const Route = createFileRoute('/v/$token')({
  component: VerifyPage,
});

/**
 * Public page behind the QR code on the label (mostly opened on phones). Each load records a scan,
 * so the query runs once: no refetch on focus, no retry, never stale.
 */
function VerifyPage() {
  const { token } = Route.useParams();
  const { t } = useTranslation();
  const query = useVerificationVerify(token, {
    query: {
      staleTime: Infinity,
      gcTime: Infinity,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: false,
    },
  });
  const result = ok(query.data);
  const unknown = query.error instanceof ApiError && query.error.status === 404;

  return (
    <div className="mx-auto max-w-md">
      {query.isPending ? (
        <Loading />
      ) : unknown ? (
        <Verdict
          tone="danger"
          icon={<ShieldX className="size-12" />}
          title={t('verify.unknownTitle')}
        >
          <p>{t('verify.unknownText')}</p>
        </Verdict>
      ) : query.error || !result ? (
        <ErrorAlert error={query.error} />
      ) : (
        <VerificationResult result={result} />
      )}
      <p className="mt-6 text-center text-sm">
        <Link to="/" className="text-primary underline">
          {t('verify.shop')}
        </Link>
      </p>
    </div>
  );
}

function VerificationResult({ result }: { result: Verification }) {
  const { t } = useTranslation();
  const ok = result.resultat === 'authentique';
  return (
    <>
      <Verdict
        tone={ok ? 'success' : 'warning'}
        icon={ok ? <BadgeCheck className="size-12" /> : <ShieldAlert className="size-12" />}
        title={ok ? t('verify.authentic') : t('verify.warning')}
      >
        {ok ? (
          <p>{t('verify.authenticText', { coop: result.cooperative.nom })}</p>
        ) : (
          <ul className="grid gap-1 text-start">
            {result.alertes.map((a) => (
              <li key={a}>• {t(`verify.alerte.${a}`)}</li>
            ))}
          </ul>
        )}
      </Verdict>

      <dl className="mt-4 grid gap-3 rounded-2xl border bg-card p-5 text-sm">
        <Row label={t('verify.produit')} value={result.produit.nom} />
        <Row
          label={t('verify.cooperative')}
          value={`${result.cooperative.nom} — ${result.cooperative.province}`}
        />
        <Row label={t('verify.lot')} value={result.lot.numero} />
        {result.numero_serie !== null && (
          <Row label={t('verify.serie')} value={String(result.numero_serie)} />
        )}
        <Row
          label={t('verify.fabrication')}
          value={<DateText value={result.lot.date_fabrication} />}
        />
        <Row
          label={t('verify.peremption')}
          value={<DateText value={result.lot.date_peremption} />}
        />
        <Row label={t('verify.scans')} value={t('verify.scansCount', { count: result.nb_scans })} />
      </dl>
    </>
  );
}

function Verdict({
  tone,
  icon,
  title,
  children,
}: {
  tone: 'success' | 'warning' | 'danger';
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  const styles = {
    success: 'bg-emerald-50 text-emerald-900 border-emerald-200',
    warning: 'bg-amber-50 text-amber-900 border-amber-200',
    danger: 'bg-red-50 text-red-900 border-red-200',
  }[tone];
  return (
    <section
      className={`flex flex-col items-center gap-2 rounded-2xl border p-6 text-center ${styles}`}
      role="status"
      aria-live="polite"
    >
      {icon}
      <h1 className="text-2xl font-bold">{title}</h1>
      <div className="text-sm">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-end font-medium">{value}</dd>
    </div>
  );
}
