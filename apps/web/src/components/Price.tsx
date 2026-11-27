import { cn } from '@agricoop/ui';
import NumberFlow from '@number-flow/react';
import { useLocale } from './common';

/**
 * Animated price (NumberFlow) with the same rendering as `formatMad`: two decimals, grouped
 * thousands, "MAD" / "د.م.". The value stays a money STRING: Intl formats numeric strings exactly,
 * so no float is ever involved.
 */
export function Price({ value, className }: { value: string; className?: string }) {
  const locale = useLocale();
  return (
    <span className={cn('tabular-nums whitespace-nowrap', className)}>
      <NumberFlow
        value={value as `${number}`}
        locales="fr-FR"
        format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }}
        suffix={locale === 'ar' ? ' د.م.' : ' MAD'}
        willChange
      />
    </span>
  );
}
