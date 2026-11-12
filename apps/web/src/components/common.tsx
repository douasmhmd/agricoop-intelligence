import { formatMad } from '@agricoop/shared';
import { AlertTriangle, Inbox, Loader2, Minus, Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '@/api/fetcher';
import { Button } from '@agricoop/ui';

export function useLocale(): 'fr' | 'ar' {
  const { i18n } = useTranslation();
  return i18n.language === 'ar' ? 'ar' : 'fr';
}

export function Money({
  value,
  className,
}: {
  value: string | null | undefined;
  className?: string;
}) {
  const locale = useLocale();
  if (value === null || value === undefined) return <span>—</span>;
  return (
    <span className={`tabular-nums whitespace-nowrap ${className ?? ''}`}>
      {formatMad(value, locale)}
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
    dateStyle: 'long',
    ...(withTime ? { timeStyle: 'short' } : {}),
    timeZone: 'Africa/Casablanca',
  });
  return <time dateTime={value}>{fmt.format(date)}</time>;
}

export function Loading() {
  const { t } = useTranslation();
  return (
    <div
      className="flex items-center justify-center gap-2 py-12 text-muted-foreground"
      role="status"
    >
      <Loader2 className="size-5 animate-spin" /> {t('common.loading')}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-12 text-center text-muted-foreground">
      <Inbox className="size-7" />
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
      if (code) return t(`errors.${code}`, { defaultValue: error.problem?.title ?? '' });
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

export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {error && <span className="text-xs text-red-700">{error}</span>}
    </label>
  );
}

/** Large touch targets for phones. */
export function QuantityStepper({
  value,
  max,
  onChange,
  label,
}: {
  value: number;
  max: number;
  onChange: (value: number) => void;
  label: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="inline-flex items-center rounded-lg border" role="group" aria-label={label}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-10"
        onClick={() => onChange(value - 1)}
        disabled={value <= 1}
        aria-label={t('cart.less')}
      >
        <Minus className="size-4" />
      </Button>
      <span className="w-8 text-center tabular-nums" aria-live="polite">
        {value}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-10"
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        aria-label={t('cart.more')}
      >
        <Plus className="size-4" />
      </Button>
    </div>
  );
}
