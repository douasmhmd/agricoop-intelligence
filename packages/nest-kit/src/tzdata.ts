/*
 * Business dates are computed in Africa/Casablanca from the runtime's ICU time-zone data.
 * Morocco moved to permanent UTC+0 on 2026-09-20 (IANA tzdb 2026c); runtimes with older tz data
 * still apply UTC+1 and shift "today", week boundaries and displayed times by an hour.
 */
export const MIN_TZ_DATA = '2026c';

/** True when the runtime's tz data (e.g. "2026e") includes the 2026 Moroccan change. */
export function tzDataIsCurrent(version: string | undefined = process.versions.tz): boolean {
  // tzdb versions are YYYY + letter: lexical order is chronological order.
  return typeof version === 'string' && /^\d{4}[a-z]$/.test(version) && version >= MIN_TZ_DATA;
}

export function tzDataWarning(
  version: string | undefined = process.versions.tz,
): string | undefined {
  return tzDataIsCurrent(version)
    ? undefined
    : `Time-zone data ${version ?? 'unknown'} predates ${MIN_TZ_DATA}: Africa/Casablanca dates will be ` +
        'off by one hour. Use Node 24 with up-to-date ICU (the Docker images do).';
}
