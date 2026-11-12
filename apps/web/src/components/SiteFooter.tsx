import { BrandMark, Ornament, ThemeToggle, ZelligeBackdrop } from '@agricoop/ui';
import { Link } from '@tanstack/react-router';
import { ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

/** Rich footer on a deep olive band with the zellige lattice. */
export function SiteFooter() {
  const { t } = useTranslation();
  const linkClass = 'text-olive-100/75 transition-colors hover:text-white focus-visible:text-white';
  return (
    <footer className="relative isolate overflow-hidden bg-olive-950 text-olive-50">
      <ZelligeBackdrop fade="bottom" className="-z-10 [&>div]:text-gold/[0.09]" />
      <div className="mx-auto max-w-7xl px-4 pt-16 pb-10 sm:px-6 lg:px-8">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          <div className="max-w-sm">
            <Link to="/" className="inline-flex items-center gap-2 text-gold-300">
              <BrandMark className="size-9" />
              <span className="font-display text-2xl font-semibold text-white">
                {t('app.name')}
              </span>
            </Link>
            <p className="mt-4 leading-relaxed text-olive-100/75">{t('footer.tagline')}</p>
          </div>

          <nav aria-labelledby="footer-shop">
            <h2
              id="footer-shop"
              className="text-xs font-semibold tracking-[0.18em] text-gold-300 uppercase"
            >
              {t('footer.shop')}
            </h2>
            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <Link to="/" hash="produits" className={linkClass}>
                  {t('nav.products')}
                </Link>
              </li>
              <li>
                <Link to="/" hash="cooperatives" className={linkClass}>
                  {t('nav.cooperatives')}
                </Link>
              </li>
              <li>
                <Link to="/panier" className={linkClass}>
                  {t('cart.title')}
                </Link>
              </li>
              <li>
                <Link to="/compte" className={linkClass}>
                  {t('nav.account')}
                </Link>
              </li>
            </ul>
          </nav>

          <nav aria-labelledby="footer-trust">
            <h2
              id="footer-trust"
              className="text-xs font-semibold tracking-[0.18em] text-gold-300 uppercase"
            >
              {t('footer.trust')}
            </h2>
            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <Link to="/" hash="authenticite" className={linkClass}>
                  {t('nav.authenticity')}
                </Link>
              </li>
              <li>
                <Link to="/" hash="histoire" className={linkClass}>
                  {t('nav.story')}
                </Link>
              </li>
            </ul>
            <p className="mt-5 flex items-start gap-2 text-sm text-olive-100/75">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-gold-300" aria-hidden />
              {t('footer.verify')}
            </p>
          </nav>

          <div>
            <h2 className="text-xs font-semibold tracking-[0.18em] text-gold-300 uppercase">
              {t('footer.preferences')}
            </h2>
            {/* The band is dark in both themes: scope the dark tokens so the controls read on it. */}
            <div className="dark mt-4 flex flex-wrap items-center gap-3">
              <LanguageSwitcher />
              <ThemeToggle
                labels={{
                  group: t('theme.group'),
                  light: t('theme.light'),
                  dark: t('theme.dark'),
                  system: t('theme.system'),
                }}
              />
            </div>
          </div>
        </div>

        <Ornament className="mt-14 [&_.hairline-gold]:opacity-50" />
        <div className="mt-6 flex flex-col gap-2 text-xs text-olive-100/60 sm:flex-row sm:items-center sm:justify-between">
          <p>
            {t('footer.rights', { year: new Date().getFullYear() })} · {t('footer.demo')}
          </p>
          <p>{t('footer.photos')}</p>
        </div>
      </div>
    </footer>
  );
}
