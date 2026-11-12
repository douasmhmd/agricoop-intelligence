import { formatMad } from '@agricoop/shared';
import { AlertTriangle, ChevronLeft, ChevronRight, Inbox, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '@/api/fetcher';
import { Badge, Button } from '@agricoop/ui';
import { cn } from '@/lib/utils';

export function useLocale(): 'fr' | 'ar' {
  const { i18n } = useTranslation();
  return i18n.language === 'ar' ? 'ar' : 'fr';
}

export function Money({ value }: { value: string | null | undefined }) {
  const locale = useLocale();
  if (value === null || value === undefined) return <span>—</span>;
  return <span className="tabular-nums whitespace-nowrap">{formatMad(value, locale)}</span>;
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
    <Badge
      variant="outline"
      className="border-dashed text-muted-foreground"
      title={t('synthetic.hint')}
    >
      {t('synthetic.badge')}
    </Badge>
  );
}

const TONES = {
  neutral: 'bg-muted text-foreground',
  info: 'bg-sky-100 text-sky-900',
  success: 'bg-emerald-100 text-emerald-900',
  warning: 'bg-amber-100 text-amber-900',
  danger: 'bg-red-100 text-red-900',
} as const;
export type Tone = keyof typeof TONES;

export function StatusBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <Badge className={cn('border-transparent', TONES[tone])}>{children}</Badge>;
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
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
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

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
      <Inbox className="size-6" />
      {children}
    </div>
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
      className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900"
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
  return (
    <div className="mt-4 flex items-center justify-between gap-2 text-sm text-muted-foreground">
      <span>{t('common.total', { count: total })}</span>
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
        <span className="tabular-nums">
          {page} / {pages}
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

/** Label + control + validation message. */
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
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint && !error && <span className="text-xs text-muted-foreground">{hint}</span>}
      {error && <span className="text-xs text-red-700">{error}</span>}
    </label>
  );
}

/** Native select styled like shadcn inputs (accessible, no portal, RTL-safe). */
export function NativeSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        'h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        props.className,
      )}
    />
  );
}
