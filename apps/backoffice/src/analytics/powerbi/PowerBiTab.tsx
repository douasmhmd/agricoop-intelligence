/*
 * "Power BI" tab of /analyses: the data plane's report, embedded for the caller's cooperative.
 * The API gives a short-lived embed token filtered by row-level security (it alone holds the
 * Power BI service principal); this component embeds it, refreshes the token in place before it
 * expires, applies the brand theme (light/dark) and follows the app language.
 * Loaded lazily (powerbi-client is large).
 */
import type { PowerBiEmbedConfig, PowerBiReport } from '@agricoop/shared';
import {
  Badge,
  Button,
  Card,
  cn,
  Skeleton,
  Tabs,
  TabsList,
  TabsTrigger,
  useTheme,
  ZelligeBackdrop,
} from '@agricoop/ui';
import { fadeUpSmall, transition } from '@agricoop/ui/motion';
import { models, type Report } from 'powerbi-client';
import { PowerBIEmbed } from 'powerbi-client-react';
import { BarChart3, Info, RefreshCw, ShieldCheck, Unplug } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { usePowerBiEmbed, usePowerBiReports } from '@/api/generated/powerbi/powerbi';
import { ok } from '@/api/ok';
import { DateText, useErrorMessage } from '@/components/common';
import { usePreferences } from '@/state/preferences';
import { isTokenExpired, refreshDelay, reportLocale } from './embed';
import darkTheme from './theme-dark.json';
import lightTheme from './theme-light.json';

const MOBILE = '(max-width: 639px)';
function useMobile(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(MOBILE);
      query.addEventListener('change', onChange);
      return () => query.removeEventListener('change', onChange);
    },
    () => window.matchMedia(MOBILE).matches,
    () => false,
  );
}

export default function PowerBiTab() {
  const { t } = useTranslation();
  const { synthetic } = usePreferences();
  const query = usePowerBiReports();
  const data = ok(query.data);
  const [selected, setSelected] = useState<string>();

  if (query.isPending) return <EmbedSkeleton withPicker />;
  if (query.error) return <RetryCard error={query.error} onRetry={() => void query.refetch()} />;
  if (!data || data.mode === 'demo') return <NotConfigured missing={data?.missing ?? []} />;
  if (data.reports.length === 0) return <NotConfigured missing={['POWERBI_REPORTS']} />;

  const current: PowerBiReport =
    data.reports.find((r) => r.key === selected) ?? (data.reports[0] as PowerBiReport);

  return (
    <motion.div variants={fadeUpSmall} initial="hidden" animate="visible" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {data.reports.length > 1 ? (
          <Tabs value={current.key} onValueChange={setSelected}>
            <TabsList
              aria-label={t('analyses.powerbi.picker')}
              className="max-w-full overflow-x-auto"
            >
              {data.reports.map((r) => (
                <TabsTrigger key={r.key} value={r.key}>
                  {r.title}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        ) : (
          <h2 className="text-base font-semibold">{current.title}</h2>
        )}
        {current.lastRefresh && (
          <span className="text-xs text-muted-foreground">
            {t('analyses.powerbi.lastRefresh')} <DateText value={current.lastRefresh} withTime />
          </span>
        )}
      </div>
      {synthetic === 'exclude' && (
        <p className="flex items-start gap-2 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {t('analyses.powerbi.syntheticNote')}
        </p>
      )}
      {/* Keyed by report: switching reports starts a fresh embed (and token). */}
      <ReportEmbed key={current.key} reportKey={current.key} />
    </motion.div>
  );
}

function ReportEmbed({ reportKey }: { reportKey: string }) {
  const { t, i18n } = useTranslation();
  const { resolved } = useTheme();
  const mobile = useMobile();
  const query = usePowerBiEmbed(reportKey, {
    query: {
      // One token per mount, renewed on schedule (below), never on focus or reconnect.
      staleTime: Infinity,
      gcTime: 0,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
    },
  });
  const { refetch } = query;
  const data = ok(query.data);
  const embed = data?.embed ?? undefined;

  // Set by the embed callback (not during render): used by effects only.
  const reportRef = useRef<Report | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [embedError, setEmbedError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // The token an embed STARTS with. PowerBIEmbed re-embeds whenever its config changes, so a
  // refreshed token must not enter the config; it is applied in place (setAccessToken) below.
  // A structural change (report, page, language, layout, retry) starts again with the newest token.
  const locale = reportLocale(i18n.language);
  const structure = embed
    ? [embed.reportId, embed.embedUrl, embed.pageName, locale.language, mobile, attempt].join('|')
    : '';
  const [start, setStart] = useState<{
    structure: string;
    token: string;
    embed: PowerBiEmbedConfig;
    locale: { language: string; formatLocale: string };
    mobile: boolean;
  }>();
  if (embed && start?.structure !== structure) {
    setStart({ structure, token: embed.embedToken, embed, locale, mobile });
  }

  // Token refresh 5 minutes before expiry, in place (no iframe reload).
  const expiresAt = embed?.expiresAt;
  useEffect(() => {
    if (!expiresAt) return;
    const timer = window.setTimeout(() => void refetch(), refreshDelay(expiresAt));
    return () => window.clearTimeout(timer);
  }, [expiresAt, refetch]);
  const token = embed?.embedToken;
  useEffect(() => {
    if (token && loaded && token !== start?.token) {
      void reportRef.current?.setAccessToken(token).catch(() => undefined);
    }
  }, [token, loaded, start?.token]);

  // Brand theme following the app theme (light/dark), once the report has loaded.
  const theme = resolved === 'dark' ? darkTheme : lightTheme;
  useEffect(() => {
    if (loaded) void reportRef.current?.applyTheme({ themeJson: theme }).catch(() => undefined);
  }, [theme, loaded]);

  // Rebuilt only when `start` changes (structure or retry); a refreshed token keeps the report.
  const config = useMemo(
    () => (start ? embedConfig(start.embed, start.token, start.locale, start.mobile) : null),
    [start],
  );

  const handlers = useMemo(
    () =>
      new Map([
        ['loaded', () => setLoaded(true)],
        ['rendered', () => setRendered(true)],
        [
          'error',
          (event?: { detail?: unknown }) => {
            if (isTokenExpired(event?.detail)) void refetch();
            else setEmbedError(true);
          },
        ],
      ]),
    [refetch],
  );

  if (query.isPending) return <EmbedSkeleton />;
  if (query.error) return <RetryCard error={query.error} onRetry={() => void query.refetch()} />;
  if (!embed || !config) return <NotConfigured missing={data?.missing ?? []} />;
  if (embedError)
    return (
      <RetryCard
        message={t('analyses.powerbi.embedError')}
        onRetry={() => {
          setEmbedError(false);
          setLoaded(false);
          setRendered(false);
          setAttempt((n) => n + 1);
          void refetch();
        }}
      />
    );

  return (
    <Card className="relative h-[calc(100dvh-16rem)] min-h-[34rem] gap-0 overflow-hidden p-0">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="size-3.5 text-success" aria-hidden />
          {embed.rls === 'Admin' ? t('analyses.powerbi.rlsAdmin') : t('analyses.powerbi.rlsCoop')}
        </span>
        <Badge variant="outline" className="gap-1">
          <BarChart3 aria-hidden /> Power BI
        </Badge>
      </div>
      <div className="relative min-h-0 flex-1">
        {!rendered && (
          <div className="absolute inset-0 p-4" aria-hidden>
            <EmbedSkeletonBody />
          </div>
        )}
        <motion.div
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: rendered ? 1 : 0 }}
          transition={transition.ui}
        >
          <PowerBIEmbed
            embedConfig={config}
            eventHandlers={handlers}
            cssClassName="h-full w-full [&_iframe]:border-0"
            getEmbeddedComponent={(component) => {
              reportRef.current = component as Report;
            }}
          />
        </motion.div>
      </div>
    </Card>
  );
}

function embedConfig(
  embed: PowerBiEmbedConfig,
  accessToken: string,
  locale: { language: string; formatLocale: string },
  mobile: boolean,
) {
  return {
    type: 'report',
    id: embed.reportId,
    embedUrl: embed.embedUrl,
    accessToken,
    tokenType: models.TokenType.Embed,
    ...(embed.pageName ? { pageName: embed.pageName } : {}),
    settings: {
      panes: { filters: { visible: false }, pageNavigation: { visible: false } },
      background: models.BackgroundType.Transparent,
      localeSettings: locale,
      // The mobile layout is used when the report author designed one; Power BI falls back otherwise.
      layoutType: mobile ? models.LayoutType.MobilePortrait : models.LayoutType.Master,
    },
  };
}

function EmbedSkeletonBody() {
  return (
    <div className="grid h-full gap-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <div className="grid min-h-0 gap-3 lg:grid-cols-3">
        <Skeleton className="h-full min-h-40 rounded-xl lg:col-span-2" />
        <Skeleton className="h-full min-h-40 rounded-xl" />
      </div>
    </div>
  );
}

function EmbedSkeleton({ withPicker = false }: { withPicker?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3" role="status" aria-label={t('common.loading')}>
      {withPicker && <Skeleton className="h-9 w-80 max-w-full rounded-lg" />}
      <Card className="h-[calc(100dvh-16rem)] min-h-[34rem] p-4">
        <EmbedSkeletonBody />
      </Card>
    </div>
  );
}

function RetryCard({
  error,
  message,
  onRetry,
}: {
  error?: unknown;
  message?: string;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  return (
    <Card className="items-center gap-4 px-6 py-12 text-center">
      <Unplug className="size-6 text-muted-foreground" aria-hidden />
      <p className="max-w-md text-sm text-muted-foreground">
        {message ?? (error ? errorMessage(error) : t('errors.generic'))}
      </p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw /> {t('analyses.powerbi.retry')}
      </Button>
    </Card>
  );
}

function NotConfigured({ missing }: { missing: string[] }) {
  const { t } = useTranslation();
  return (
    <motion.div variants={fadeUpSmall} initial="hidden" animate="visible">
      <Card className="relative isolate items-center gap-4 overflow-hidden px-6 py-14 text-center">
        <ZelligeBackdrop />
        <span className="grid size-12 place-items-center rounded-full border bg-card text-primary shadow-soft">
          <BarChart3 className="size-5" aria-hidden />
        </span>
        <h2 className="font-display text-lg font-semibold">
          {t('analyses.powerbi.notConfiguredTitle')}
        </h2>
        <p className="max-w-lg text-sm text-muted-foreground">
          {t('analyses.powerbi.notConfiguredText')}
        </p>
        {missing.length > 0 && (
          <ul
            className="flex max-w-lg flex-wrap justify-center gap-1.5"
            aria-label={t('analyses.powerbi.missing')}
          >
            {missing.map((name) => (
              <li key={name}>
                <code
                  dir="ltr"
                  className={cn('rounded-md border bg-muted px-1.5 py-0.5 font-mono text-xs')}
                >
                  {name}
                </code>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">
          {t('analyses.powerbi.docs')}{' '}
          <code dir="ltr" className="font-mono">
            docs/powerbi-embedding.md
          </code>
        </p>
      </Card>
    </motion.div>
  );
}
