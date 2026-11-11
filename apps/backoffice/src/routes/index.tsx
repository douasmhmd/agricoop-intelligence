import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/')({
  component: Home,
});

function Home() {
  const { t } = useTranslation();
  return (
    <section className="space-y-3">
      <h1 className="text-2xl font-bold text-olive-900">{t('home.title')}</h1>
      <p className="text-stone-700">{t('app.tagline')}</p>
      <p className="text-stone-700">{t('home.intro')}</p>
      <p className="rounded-lg border-s-4 border-olive-600 bg-olive-50 ps-3 pe-2 py-2 text-sm text-stone-700">
        {t('home.verifyHint')}
      </p>
    </section>
  );
}
