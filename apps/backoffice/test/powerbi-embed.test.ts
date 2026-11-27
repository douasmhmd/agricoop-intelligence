import { describe, expect, it } from 'vitest';
import {
  isTokenExpired,
  REFRESH_BEFORE_MS,
  refreshDelay,
  reportLocale,
} from '../src/analytics/powerbi/embed';

describe('Power BI embed helpers', () => {
  const now = Date.parse('2026-11-18T10:00:00Z');

  it('refreshes 5 minutes before expiry, never in a tight loop', () => {
    expect(refreshDelay('2026-11-18T11:00:00Z', now)).toBe(60 * 60_000 - REFRESH_BEFORE_MS);
    expect(refreshDelay('2026-11-18T10:02:00Z', now)).toBe(30_000);
    expect(refreshDelay('2026-11-18T09:00:00Z', now)).toBe(30_000);
    expect(refreshDelay('not a date', now)).toBe(30_000);
  });

  it('recognises the expired-token error', () => {
    expect(isTokenExpired({ message: 'TokenExpired' })).toBe(true);
    expect(isTokenExpired({ message: 'LoadReportFailed' })).toBe(false);
    expect(isTokenExpired(undefined)).toBe(false);
  });

  it('follows the app language', () => {
    expect(reportLocale('ar')).toEqual({ language: 'ar', formatLocale: 'ar-MA' });
    expect(reportLocale('fr')).toEqual({ language: 'fr', formatLocale: 'fr-FR' });
  });
});
