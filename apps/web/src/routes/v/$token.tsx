import type { Verification } from '@agricoop/shared';
import { cn, Picture, ZelligeBackdrop } from '@agricoop/ui';
import { ease, fadeUp, spring, stagger } from '@agricoop/ui/motion';
import { createFileRoute, Link } from '@tanstack/react-router';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Copy,
  MapPinned,
  Info,
  ScanLine,
  ShieldAlert,
  ShieldX,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '@/api/fetcher';
import { useVerificationVerify } from '@/api/generated/verification/verification';
import { ok } from '@/api/ok';
import { DateText, ErrorAlert } from '@/components/common';
import { photo, productPhoto } from '@/lib/images';

export const Route = createFileRoute('/v/$token')({
  component: VerifyPage,
});

/**
 * Public page behind the QR code on the label (mostly opened from a phone camera). Each load
 * records a scan, so the query runs once: no refetch on focus, no retry, never stale.
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
        <ScanLoader label={t('verify.checking')} />
      ) : unknown ? (
        <Verdict tone="danger" title={t('verify.unknownTitle')} emblem={<DangerEmblem />}>
          <p>{t('verify.unknownText')}</p>
          <Advice>{t('verify.unknownAdvice')}</Advice>
        </Verdict>
      ) : query.error || !result ? (
        <ErrorAlert error={query.error} />
      ) : (
        <VerificationResult result={result} />
      )}
      <p className="mt-10 text-center text-sm">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
        >
          {t('verify.shop')}
          <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
        </Link>
      </p>
    </div>
  );
}

function VerificationResult({ result }: { result: Verification }) {
  const { t } = useTranslation();
  const authentic = result.resultat === 'authentique';
  return (
    <>
      {authentic ? (
        <Verdict
          tone="success"
          title={t('verify.authentic')}
          emblem={<Seal label={t('verify.seal')} />}
        >
          <p>{t('verify.authenticText', { coop: result.cooperative.nom })}</p>
        </Verdict>
      ) : (
        <Verdict tone="warning" title={t('verify.warning')} emblem={<WarningEmblem />}>
          <ul className="mt-1 grid gap-2 text-start">
            {result.alertes.map((a) => (
              <li
                key={a}
                className="flex items-start gap-3 rounded-xl border border-warning/40 bg-card/80 p-3 text-foreground"
              >
                <AlerteIcon alerte={a} />
                <span>{t(`verify.alerte.${a}`)}</span>
              </li>
            ))}
          </ul>
          <Advice>{t('verify.warningAdvice')}</Advice>
        </Verdict>
      )}
      <ProductDetails result={result} />
    </>
  );
}

function AlerteIcon({ alerte }: { alerte: Verification['alertes'][number] }) {
  const Icon =
    alerte === 'villes_multiples'
      ? MapPinned
      : alerte === 'scans_multiples'
        ? Copy
        : alerte === 'lot_perime'
          ? CalendarClock
          : AlertTriangle;
  return (
    <Icon
      className="mt-0.5 size-4 shrink-0 text-warning-foreground dark:text-warning"
      aria-hidden
    />
  );
}

function ProductDetails({ result }: { result: Verification }) {
  const { t } = useTranslation();
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: ease.out, delay: 0.9 }}
      aria-label={t('verify.details')}
      className="mt-6 overflow-hidden rounded-3xl border bg-card shadow-lifted"
    >
      <Picture
        {...photo(productPhoto(result.produit.categorie, result.produit.famille), '28rem', 960)}
        alt=""
        className="aspect-[16/9]"
      >
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent"
        />
        <p className="absolute inset-x-5 bottom-4 font-display text-xl leading-snug font-semibold text-white">
          {result.produit.nom}
        </p>
      </Picture>
      <dl className="grid gap-3 p-5 text-sm">
        <Row
          label={t('verify.cooperative')}
          value={`${result.cooperative.nom} — ${result.cooperative.province}`}
        />
        <Row label={t('verify.lot')} value={<span dir="ltr">{result.lot.numero}</span>} />
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
    </motion.section>
  );
}

const TONES = {
  success: 'border-success/25 bg-success/8',
  warning: 'border-warning/45 bg-warning/12',
  danger: 'border-destructive/25 bg-destructive/8',
} as const;

const TITLE_TONES = {
  success: 'text-success',
  warning: 'text-warning-foreground dark:text-warning',
  danger: 'text-destructive',
} as const;

function Verdict({
  tone,
  title,
  emblem,
  children,
}: {
  tone: keyof typeof TONES;
  title: string;
  emblem: ReactNode;
  children: ReactNode;
}) {
  return (
    <motion.section
      variants={stagger(0.12)}
      initial="hidden"
      animate="visible"
      className={cn(
        'grain relative isolate flex flex-col items-center gap-3 overflow-hidden rounded-3xl border px-6 pt-8 pb-7 text-center',
        TONES[tone],
      )}
      role="status"
      aria-live="polite"
    >
      <ZelligeBackdrop className="-z-10" />
      <motion.div variants={fadeUp}>{emblem}</motion.div>
      <motion.h1
        variants={fadeUp}
        className={cn('font-display text-display-md font-semibold', TITLE_TONES[tone])}
      >
        {title}
      </motion.h1>
      <motion.div variants={fadeUp} className="w-full text-sm leading-relaxed text-foreground/85">
        {children}
      </motion.div>
    </motion.section>
  );
}

function Advice({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="mt-4 flex items-start gap-3 rounded-xl bg-card/80 p-3 text-start text-sm">
      <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      <p>
        <span className="font-semibold">{t('verify.whatToDo')}</span> {children}
      </p>
    </div>
  );
}

/** Gold 8-point seal turning into place, with a checkmark drawn inside. */
function Seal({ label }: { label: string }) {
  const reduced = useReducedMotion();
  return (
    <div className="relative mx-auto size-32" role="img" aria-label={label}>
      <motion.div
        aria-hidden
        className="absolute inset-0 rounded-full bg-gold/30 blur-2xl"
        animate={reduced ? undefined : { opacity: [0.5, 0.9, 0.5] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.svg
        viewBox="0 0 120 120"
        className="relative size-full drop-shadow-[0_8px_16px_rgba(0,0,0,0.15)]"
        initial={{ rotate: -45, scale: 0.6, opacity: 0 }}
        animate={{ rotate: 0, scale: 1, opacity: 1 }}
        transition={spring.soft}
      >
        <defs>
          <linearGradient id="seal-gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="oklch(0.88 0.11 82)" />
            <stop offset="0.55" stopColor="oklch(0.73 0.145 72)" />
            <stop offset="1" stopColor="oklch(0.58 0.12 65)" />
          </linearGradient>
        </defs>
        {/* Two overlapping squares: the 8-point Moroccan star. */}
        <rect x="22" y="22" width="76" height="76" rx="6" fill="url(#seal-gold)" />
        <rect
          x="22"
          y="22"
          width="76"
          height="76"
          rx="6"
          fill="url(#seal-gold)"
          transform="rotate(45 60 60)"
        />
        <circle
          cx="60"
          cy="60"
          r="31"
          fill="oklch(0.5 0.115 150)"
          stroke="oklch(0.95 0.045 85)"
          strokeWidth="3"
        />
        <motion.path
          d="M46 61l10 10 19-21"
          fill="none"
          stroke="white"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.55, delay: 0.45, ease: ease.out }}
        />
      </motion.svg>
    </div>
  );
}

function WarningEmblem() {
  const reduced = useReducedMotion();
  return (
    <div className="relative mx-auto grid size-28 place-items-center" aria-hidden>
      {!reduced && (
        <motion.span
          className="absolute inset-2 rounded-full border-2 border-warning"
          animate={{ scale: [1, 1.35], opacity: [0.6, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
        />
      )}
      <motion.span
        className="grid size-24 place-items-center rounded-full bg-warning/25 text-warning-foreground dark:text-warning"
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={spring.bouncy}
      >
        <ShieldAlert className="size-12" strokeWidth={1.6} />
      </motion.span>
    </div>
  );
}

function DangerEmblem() {
  return (
    <motion.span
      aria-hidden
      className="mx-auto grid size-24 place-items-center rounded-full bg-destructive/15 text-destructive"
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={spring.bouncy}
    >
      <ShieldX className="size-12" strokeWidth={1.6} />
    </motion.span>
  );
}

/** Loading state: a QR frame with a sweeping gold line (static with reduced motion). */
function ScanLoader({ label }: { label: string }) {
  const reduced = useReducedMotion();
  return (
    <div role="status" className="flex flex-col items-center gap-6 py-16 text-muted-foreground">
      <div className="relative size-40 rounded-3xl border bg-card p-6 shadow-lifted">
        <ScanLine className="size-full text-primary/25" strokeWidth={1} aria-hidden />
        {[
          'start-0 top-0 border-s-3 border-t-3 rounded-ss-3xl',
          'end-0 top-0 border-e-3 border-t-3 rounded-se-3xl',
          'start-0 bottom-0 border-s-3 border-b-3 rounded-es-3xl',
          'end-0 bottom-0 border-e-3 border-b-3 rounded-ee-3xl',
        ].map((c) => (
          <span key={c} aria-hidden className={`absolute size-8 border-gold ${c}`} />
        ))}
        {!reduced && (
          <motion.div
            aria-hidden
            className="absolute inset-4"
            animate={{ y: ['0%', '100%', '0%'] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          >
            <span className="absolute inset-x-0 top-0 h-0.5 rounded-full bg-gold shadow-[0_0_14px_3px_var(--gold)]" />
          </motion.div>
        )}
      </div>
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/60 pb-3 last:border-0 last:pb-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-end font-medium">{value}</dd>
    </div>
  );
}
