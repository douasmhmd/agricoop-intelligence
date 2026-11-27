/*
 * Pure helpers of the Power BI embedding (unit-tested): token refresh timing, expiry detection and
 * the report locale.
 */

/** Refresh the embed token this long before it expires. */
export const REFRESH_BEFORE_MS = 5 * 60_000;
/** Never schedule refreshes closer together than this (a token Power BI granted for very little). */
const MIN_DELAY_MS = 30_000;

/** Milliseconds until the token should be refreshed (≥ 30 s, so a short token cannot spin). */
export function refreshDelay(expiresAt: string, now: number = Date.now()): number {
  const expiry = Date.parse(expiresAt);
  if (Number.isNaN(expiry)) return MIN_DELAY_MS;
  return Math.max(MIN_DELAY_MS, expiry - REFRESH_BEFORE_MS - now);
}

/**
 * powerbi-client reports an expired token through its `error` event (it has no separate
 * `tokenExpired` event): detail.message is "TokenExpired".
 */
export function isTokenExpired(detail: unknown): boolean {
  const message = (detail as { message?: unknown } | undefined)?.message;
  return typeof message === 'string' && /tokenexpired/i.test(message);
}

/** Report language and number/date formats follow the back office's language. */
export function reportLocale(language: string): { language: string; formatLocale: string } {
  return language === 'ar'
    ? { language: 'ar', formatLocale: 'ar-MA' }
    : { language: 'fr', formatLocale: 'fr-FR' };
}
