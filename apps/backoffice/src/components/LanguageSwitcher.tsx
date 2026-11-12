import { cn } from '@agricoop/ui';
import { spring } from '@agricoop/ui/motion';
import { motion } from 'motion/react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { LANGUAGES, setLanguage, type Language } from '@/i18n';

/** Short endonyms for narrow screens; the full name stays the accessible label. */
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
            aria-label={t(`language.${lng}`)}
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
            <span aria-hidden className="relative sm:hidden">
              {SHORT[lng]}
            </span>
            <span aria-hidden className="relative max-sm:hidden">
              {t(`language.${lng}`)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
