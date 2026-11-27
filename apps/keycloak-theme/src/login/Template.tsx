/*
 * Frame of every login-theme page, in the storefront / back-office brand:
 * - desktop: split screen — an arch-masked olive-grove photo with the zellige lattice, the brand
 *   and the tagline on one side, the auth card on the other (sides mirror in RTL);
 * - phones: one column with a compact photo header.
 * Language switcher wired to Keycloak's locales (sets lang/dir), light/dark/system theme,
 * entrance animation (card fade-up, slow photo zoom) that reduced motion turns into fades.
 */
import { BrandMark, cn, ThemeToggle } from '@agricoop/ui';
import { ease, fadeUp, stagger } from '@agricoop/ui/motion';
import { kcSanitize } from 'keycloakify/lib/kcSanitize';
import { useInitialize } from 'keycloakify/login/Template.useInitialize';
import type { TemplateProps } from 'keycloakify/login/TemplateProps';
import { CircleAlert, CircleCheck, Info, Lock, RotateCcw, TriangleAlert } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect } from 'react';
import groveLarge from '../assets/olive-grove-1100.webp';
import groveSmall from '../assets/olive-grove-720.webp';
import type { I18n } from './i18n';
import type { KcContext } from './KcContext';

/** Short labels for the language switcher (the realm offers fr, ar, en). */
const LANGUAGE_LABELS: Record<string, { short: string; full: string }> = {
  fr: { short: 'FR', full: 'Français' },
  ar: { short: 'ع', full: 'العربية' },
  en: { short: 'EN', full: 'English' },
};

const LANGUAGE_ORDER = ['fr', 'ar', 'en'];
const languageRank = (tag: string) => {
  const i = LANGUAGE_ORDER.indexOf(tag);
  return i === -1 ? LANGUAGE_ORDER.length : i;
};

const ALERT = {
  success: { icon: CircleCheck, className: 'border-success/30 bg-success/10 text-success' },
  warning: {
    icon: TriangleAlert,
    className: 'border-warning/50 bg-warning/15 text-warning-foreground dark:text-warning',
  },
  error: {
    icon: CircleAlert,
    className: 'border-destructive/30 bg-destructive/10 text-destructive',
  },
  info: { icon: Info, className: 'border-info/30 bg-info/10 text-info' },
} as const;

export default function Template(props: TemplateProps<KcContext, I18n>) {
  const {
    displayInfo = false,
    displayMessage = true,
    displayRequiredFields = false,
    headerNode,
    socialProvidersNode = null,
    infoNode = null,
    documentTitle,
    kcContext,
    i18n,
    doUseDefaultCss,
    children,
  } = props;
  const { msg, msgStr, currentLanguage, enabledLanguages } = i18n;
  const { realm, auth, url, message, isAppInitiatedAction } = kcContext;
  const languageTag = currentLanguage.languageTag;

  useEffect(() => {
    document.title = documentTitle ?? msgStr('loginTitle', realm.displayName || realm.name);
  }, [documentTitle, msgStr, realm.displayName, realm.name]);
  useEffect(() => {
    document.documentElement.lang = languageTag;
    document.documentElement.dir = languageTag === 'ar' ? 'rtl' : 'ltr';
  }, [languageTag]);

  const { isReadyToRender } = useInitialize({ kcContext, doUseDefaultCss });
  if (!isReadyToRender) return null;

  const alert =
    displayMessage && message !== undefined && (message.type !== 'warning' || !isAppInitiatedAction)
      ? message
      : undefined;
  const AlertIcon = alert ? ALERT[alert.type].icon : null;
  const showUsername = auth !== undefined && auth.showUsername && !auth.showResetCredentials;

  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      {/* Photo side (desktop). */}
      <aside className="relative hidden p-5 lg:block" aria-hidden>
        <div className="arch relative isolate h-full min-h-[36rem] overflow-hidden shadow-float">
          <motion.img
            src={groveLarge}
            alt=""
            className="absolute inset-0 size-full object-cover"
            initial={{ scale: 1.08 }}
            animate={{ scale: 1 }}
            // Slow "breathing" zoom (a transform: off with reduced motion).
            transition={{ duration: 14, ease: ease.out }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-olive-950/85 via-olive-950/25 to-transparent" />
          {/* Two layers: the fade mask and the lattice mask would override each other. */}
          <div className="absolute inset-0 [mask-image:linear-gradient(to_top,black,transparent_70%)]">
            <div className="zellige absolute inset-0 text-white/[0.08]" />
          </div>
          <div className="absolute inset-x-10 bottom-12 text-sand-50">
            <p className="text-xs font-semibold tracking-[0.2em] text-gold-300 uppercase">
              {msg('agricoopEyebrow')}
            </p>
            <p className="mt-4 max-w-md font-display text-display-md font-semibold text-balance">
              {msg('agricoopTagline')}
            </p>
            <p className="mt-3 max-w-sm text-sm text-sand-100/80">{msg('agricoopTaglineSub')}</p>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* Phones: compact photo header with the brand. */}
        <div className="relative h-36 overflow-hidden rounded-b-[2rem] lg:hidden" aria-hidden>
          <img src={groveSmall} alt="" className="absolute inset-0 size-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-olive-950/80 to-olive-950/10" />
          <div className="zellige absolute inset-0 text-white/[0.06]" />
        </div>

        <header className="flex items-center justify-between gap-3 px-5 pt-5 sm:px-8 lg:pt-8">
          <span className="flex items-center gap-2 text-primary">
            <BrandMark className="size-8" />
            <span className="font-display text-xl font-semibold text-foreground">
              {realm.displayName || 'AgriCoop'}
            </span>
          </span>
          <div className="flex items-center gap-2">
            {enabledLanguages.length > 1 && (
              <nav aria-label={msgStr('agricoopLanguage')}>
                <ul className="inline-flex items-center gap-0.5 rounded-full border border-border/70 bg-muted/60 p-0.5">
                  {/* Keycloak sorts by label (English, العربية, Français): show FR, AR, EN. */}
                  {[...enabledLanguages]
                    .sort((x, y) => languageRank(x.languageTag) - languageRank(y.languageTag))
                    .map(({ languageTag: tag, href, label }) => {
                      const names = LANGUAGE_LABELS[tag] ?? {
                        short: tag.toUpperCase(),
                        full: label,
                      };
                      const active = tag === languageTag;
                      return (
                        <li key={tag}>
                          <a
                            href={href}
                            lang={tag}
                            aria-current={active ? 'true' : undefined}
                            className={cn(
                              'grid h-7 min-w-9 place-items-center rounded-full px-2.5 text-sm font-medium transition-colors',
                              active
                                ? 'bg-primary text-primary-foreground shadow-soft'
                                : 'text-muted-foreground hover:text-foreground',
                            )}
                          >
                            <span className="sm:hidden">{names.short}</span>
                            <span className="sr-only sm:not-sr-only">{names.full}</span>
                          </a>
                        </li>
                      );
                    })}
                </ul>
              </nav>
            )}
            <ThemeToggle
              className="max-sm:hidden"
              labels={{
                group: msgStr('agricoopTheme'),
                light: msgStr('agricoopThemeLight'),
                dark: msgStr('agricoopThemeDark'),
                system: msgStr('agricoopThemeSystem'),
              }}
            />
          </div>
        </header>

        <main className="flex flex-1 items-start justify-center px-5 py-8 sm:px-8 lg:items-center">
          <motion.div
            variants={stagger(0.06)}
            initial="hidden"
            animate="visible"
            className="w-full max-w-md"
          >
            <motion.div
              variants={fadeUp}
              className="rounded-2xl border bg-card p-6 shadow-lifted sm:p-8"
            >
              {showUsername ? (
                <div id="kc-username" className="mb-6 flex items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block text-xs text-muted-foreground">{headerNode}</span>
                    <span
                      id="kc-attempted-username"
                      className="block truncate font-medium"
                      dir="ltr"
                    >
                      {auth.attemptedUsername}
                    </span>
                  </span>
                  <a
                    id="reset-login"
                    href={url.loginRestartFlowUrl}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <RotateCcw className="size-3.5" aria-hidden />
                    {msg('restartLoginTooltip')}
                  </a>
                </div>
              ) : (
                <h1 id="kc-page-title" className="mb-6 font-display text-display-sm font-semibold">
                  {headerNode}
                </h1>
              )}

              {displayRequiredFields && (
                <p className="-mt-3 mb-5 text-xs text-muted-foreground">
                  <span className="text-destructive">*</span> {msg('requiredFields')}
                </p>
              )}

              {alert && AlertIcon && (
                <div
                  role={alert.type === 'error' ? 'alert' : 'status'}
                  className={cn(
                    'mb-5 flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm',
                    ALERT[alert.type].className,
                  )}
                >
                  <AlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span dangerouslySetInnerHTML={{ __html: kcSanitize(alert.summary) }} />
                </div>
              )}

              {children}

              {auth !== undefined && auth.showTryAnotherWayLink && (
                <form
                  id="kc-select-try-another-way-form"
                  action={url.loginAction}
                  method="post"
                  className="mt-4 text-center"
                >
                  <input type="hidden" name="tryAnotherWay" value="on" />
                  <button
                    type="submit"
                    id="try-another-way"
                    className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {msg('doTryAnotherWay')}
                  </button>
                </form>
              )}

              {socialProvidersNode}
            </motion.div>

            {displayInfo && infoNode && (
              <motion.div
                variants={fadeUp}
                id="kc-info"
                className="mt-5 text-center text-sm text-muted-foreground"
              >
                {infoNode}
              </motion.div>
            )}
          </motion.div>
        </main>

        <footer className="flex items-center justify-center gap-1.5 px-5 pb-6 text-xs text-muted-foreground">
          <Lock className="size-3.5" aria-hidden />
          {msg('agricoopSecure')} · © {new Date().getFullYear()} AgriCoop
        </footer>
      </div>
    </div>
  );
}
