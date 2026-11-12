import { createFileRoute, Link } from '@tanstack/react-router';
import { ChevronRight, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useStorefrontList } from '@/api/generated/storefront/storefront';
import { ok } from '@/api/ok';
import { EmptyState, ErrorAlert, Loading } from '@/components/common';

export const Route = createFileRoute('/')({
  component: Home,
});

function Home() {
  const { t } = useTranslation();
  const coops = useStorefrontList();
  const list = ok(coops.data) ?? [];

  return (
    <>
      <section className="mb-6 rounded-2xl bg-primary px-5 py-7 text-primary-foreground">
        <h1 className="text-2xl font-bold">{t('home.title')}</h1>
        <p className="mt-2 opacity-90">{t('home.intro')}</p>
      </section>
      <h2 className="mb-3 text-lg font-semibold">{t('home.cooperatives')}</h2>
      {coops.isPending ? (
        <Loading />
      ) : coops.error ? (
        <ErrorAlert error={coops.error} />
      ) : list.length === 0 ? (
        <EmptyState>{t('home.none')}</EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {list.map((c) => (
            <li key={c.code}>
              <Link
                to="/coops/$code"
                params={{ code: c.code }}
                className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-accent"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.nom}</p>
                  <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="size-3.5" /> {c.province}
                  </p>
                </div>
                <ChevronRight className="size-5 text-muted-foreground rtl:rotate-180" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
