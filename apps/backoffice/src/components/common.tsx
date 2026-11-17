import { formatMad } from '@agricoop/shared';
import { fadeUpSmall } from '@agricoop/ui/motion';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Loader2,
  type LucideIcon,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { cloneElement, isValidElement, type ReactNode, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '@/api/fetcher';
import { Badge, Button, ZelligeBackdrop } from '@agricoop/ui';
import { cn } from '@/lib/utils';

export function useLocale(): 'fr' | 'ar' {
  const { i18n } = useTranslation();
  return i18n.language === 'ar' ? 'ar' : 'fr';
}

export function Money({ value }: { value: string | null | undefined }) {
  const locale = useLocale();
  if (value === null || value === undefined) return <span>—</span>;
  // Margins can be negative ("-3.50"); formatMad takes the absolute amount.
  const negative = value.startsWith('-');
  return (
    <span className="tabular-nums whitespace-nowrap">
      {negative && '−'}
      {formatMad(negative ? value.slice(1) : value, locale)}
    </span>
  );
}

export function DateText({
  value,
  withTime = false,
}: {
  value: string | null | undefined;
  withTime?: boolean;
}) {
  const locale = useLocale();
  if (!value) return <span>—</span>;
  const date = value.length === 10 ? new Date(`${value}T12:00:00Z`) : new Date(value);
  const fmt = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-MA' : 'fr-MA', {
    dateStyle: 'medium',
    ...(withTime ? { timeStyle: 'short' } : {}),
    timeZone: 'Africa/Casablanca',
  });
  return (
    <time dateTime={value} className="whitespace-nowrap">
      {fmt.format(date)}
    </time>
  );
}

export function SyntheticBadge({ show }: { show: boolean }) {
  const { t } = useTranslation();
  if (!show) return null;
  return (
    <Badge variant="synthetic" className="px-1.5 py-0 text-[0.625rem]" title={t('synthetic.hint')}>
      {t('synthetic.badge')}
    </Badge>
  );
}

const TONE_VARIANT = {
  neutral: 'secondary',
  info: 'info',
  success: 'success',
  warning: 'warning',
  danger: 'destructive',
} as const;
export type Tone = keyof typeof TONE_VARIANT;

/** Status with a coloured dot (order, lot, QR statuses; alert levels). */
export function StatusBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <Badge variant={TONE_VARIANT[tone]} dot>
      {children}
    </Badge>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex max-w-full min-w-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Loading() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2 py-10 text-muted-foreground" role="status">
      <Loader2 className="size-4 animate-spin" /> {t('common.loading')}
    </div>
  );
}

/** Empty list: faint zellige texture, an icon medallion, a message and an optional action. */
export function EmptyState({
  children,
  title,
  icon: Icon = Inbox,
  action,
}: {
  children: ReactNode;
  title?: string;
  icon?: LucideIcon;
  action?: ReactNode;
}) {
  return (
    <motion.div
      variants={fadeUpSmall}
      initial="hidden"
      animate="visible"
      className="relative isolate flex flex-col items-center gap-3 overflow-hidden rounded-xl border border-dashed bg-card/60 px-6 py-14 text-center"
    >
      <ZelligeBackdrop />
      <span className="grid size-12 place-items-center rounded-full border bg-card text-primary shadow-soft">
        <Icon className="size-5" aria-hidden />
      </span>
      {title && <p className="font-display text-lg font-semibold">{title}</p>}
      <p className="max-w-sm text-sm text-muted-foreground">{children}</p>
      {action}
    </motion.div>
  );
}

/** Translates an API problem by its stable `code`, falling back to its title. */
export function useErrorMessage(): (error: unknown) => string {
  const { t } = useTranslation();
  return (error) => {
    if (error instanceof ApiError) {
      const code = (error.problem as { code?: string } | undefined)?.code;
      if (code)
        return t(`errors.${code}`, {
          defaultValue: error.problem?.detail ?? error.problem?.title ?? '',
        });
      if (error.status === 403) return t('errors.forbidden');
      return error.problem?.title ?? t('errors.generic');
    }
    return t('errors.generic');
  };
}

export function ErrorAlert({ error }: { error: unknown }) {
  const message = useErrorMessage();
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <span>{message(error)}</span>
    </div>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const { t } = useTranslation();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1 text-sm text-muted-foreground">
      <span className="tabular-nums">{t('common.range', { from, to, total })}</span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label={t('common.previous')}
        >
          <ChevronLeft className="size-4 rtl:rotate-180" />
        </Button>
        <span className="min-w-14 text-center text-xs tabular-nums">
          {t('common.page', { page, pages })}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          aria-label={t('common.next')}
        >
          <ChevronRight className="size-4 rtl:rotate-180" />
        </Button>
      </div>
    </div>
  );
}

/** Label + control + hint or validation message (animated in, linked to the control). */
export function Field({
  label,
  error,
  children,
  hint,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  const id = useId();
  const messageId = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  const control = isValidElement<Record<string, unknown>>(children)
    ? cloneElement(children, {
        'aria-invalid': error ? true : undefined,
        'aria-describedby': messageId,
      })
    : children;
  return (
    <label className="grid content-start gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {control}
      <AnimatePresence initial={false} mode="wait">
        {error ? (
          <motion.span
            key="error"
            id={messageId}
            variants={fadeUpSmall}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex items-center gap-1 text-xs text-destructive"
          >
            <AlertTriangle className="size-3 shrink-0" aria-hidden />
            {error}
          </motion.span>
        ) : (
          hint && (
            <motion.span
              key="hint"
              id={messageId}
              variants={fadeUpSmall}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="text-xs text-muted-foreground"
            >
              {hint}
            </motion.span>
          )
        )}
      </AnimatePresence>
    </label>
  );
}

/** Native select styled like shadcn inputs (accessible, no portal, RTL-safe). */
export function NativeSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        'h-9 rounded-lg border border-input bg-background px-3 text-sm shadow-xs transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive',
        props.className,
      )}
    />
  );
}
