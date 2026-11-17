import { cn } from '@agricoop/ui';
import { spring } from '@agricoop/ui/motion';
import { motion } from 'motion/react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { LANGUAGES, setLanguage, type Language } from '@/i18n';

/** Short endonyms for narrow screens; the full name is still read by screen readers. */
const SHORT: Record<Language, string> = { fr: 'FR', ar: 'ع' };

/** Segmented FR / AR switch; the active pill slides between the two (and mirrors in RTL). */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { t, i18n } = useTranslation();
  const layoutId = useId();
  return (
    <div
      role="group"
      aria-label={t('language.label')}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full border border-border/70 bg-muted/60 p-0.5',
        className,
      )}
    >
      {LANGUAGES.map((lng: Language) => {
        const active = i18n.language === lng;
        return (
          <button
            key={lng}
            type="button"
            lang={lng}
            aria-pressed={active}
            onClick={() => void setLanguage(lng)}
            className="relative h-7 cursor-pointer rounded-full px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground aria-pressed:text-primary-foreground"
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                aria-hidden
                className="absolute inset-0 rounded-full bg-primary shadow-soft"
                transition={spring.snappy}
              />
            )}
            {/* The accessible name contains the visible text (WCAG 2.5.3): "FR" on phones is
                followed by the full name for screen readers. */}
            <span className="relative sm:hidden">{SHORT[lng]}</span>
            <span className="sr-only sm:not-sr-only sm:relative">{t(`language.${lng}`)}</span>
          </button>
        );
      })}
    </div>
  );
}
