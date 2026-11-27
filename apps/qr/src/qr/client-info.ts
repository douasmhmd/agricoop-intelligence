import type { Appareil } from '@agricoop/shared';

/*
 * Coarse, non-identifying information about the scanning device. No IP address is ever stored or
 * logged: the city comes from a header set by the edge (CDN / ingress geo-IP); IP lookup is a stub
 * until a GeoIP database is wired in.
 */

/** Android / iPhone / Autre — the same values as the synthetic generator. */
export function deviceClass(userAgent: string | undefined): Appareil {
  if (!userAgent) return 'Autre';
  if (/android/i.test(userAgent)) return 'Android';
  if (/iphone|ipad|ipod/i.test(userAgent)) return 'iPhone';
  return 'Autre';
}

/** Headers trusted to carry the approximate city (set by our ingress / CDN). */
export const CITY_HEADERS = ['x-agricoop-city', 'cf-ipcity'] as const;

export interface GeoLocator {
  /** Approximate city or null. Implementations must not retain the IP. */
  city(
    headers: Record<string, string | string[] | undefined>,
    ip: string | undefined,
  ): string | null;
}

export const GEO_LOCATOR = Symbol.for('agricoop.GEO_LOCATOR');

function normalizeCity(raw: string): string | null {
  const value = decodeURIComponent(raw).trim().replace(/\s+/g, ' ');
  if (value.length < 2 || value.length > 80 || !/^[\p{L}\p{M}' -]+$/u.test(value)) return null;
  return value
    .toLocaleLowerCase('fr')
    .replace(
      /(^|[\s'-])(\p{L})/gu,
      (_m, sep: string, ch: string) => sep + ch.toLocaleUpperCase('fr'),
    );
}

/** Trusted header first; the IP lookup is a stub (null) in the MVP. */
export const headerGeoLocator: GeoLocator = {
  city(headers) {
    for (const name of CITY_HEADERS) {
      const value = headers[name];
      const raw = Array.isArray(value) ? value[0] : value;
      if (raw) {
        try {
          return normalizeCity(raw);
        } catch {
          return null;
        }
      }
    }
    return null;
  },
};
