import { useTranslation } from 'react-i18next';
import { LANGUAGES, setLanguage, type Language } from '@/i18n';
import { cn } from '@/lib/utils';

export function LanguageSwitcher({ className }: { className?: string }) {
  const { t, i18n } = useTranslation();
  return (
    <div role="group" aria-label={t('language.label')} className={cn('flex gap-1', className)}>
      {LANGUAGES.map((lng: Language) => (
        <button
          key={lng}
          type="button"
          lang={lng}
          aria-pressed={i18n.language === lng}
          onClick={() => void setLanguage(lng)}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            i18n.language === lng ? 'bg-olive-700 text-white' : 'text-stone-700 hover:bg-stone-200',
          )}
        >
          {t(`language.${lng}`)}
        </button>
      ))}
    </div>
  );
}
