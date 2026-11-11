/*
 * Calendar dates (DATE columns) are ISO strings "YYYY-MM-DD". Business "today" is the date in
 * Morocco, not UTC.
 */

export const APP_TIME_ZONE = 'Africa/Casablanca';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function assertIsoDate(value: string): void {
  if (!ISO_DATE.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new RangeError(`Invalid ISO date: ${JSON.stringify(value)}`);
  }
}

/** Calendar date of `instant` in `timeZone` (default Africa/Casablanca). */
export function isoDateInZone(instant: Date, timeZone: string = APP_TIME_ZONE): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

export function addDays(isoDate: string, days: number): string {
  assertIsoDate(isoDate);
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  assertIsoDate(from);
  assertIsoDate(to);
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/**
 * A lot is expired ON and after its date_peremption: it can no longer be sold that day.
 * Same rule as the synthetic generator (data/synthetic-factory).
 */
export function isExpired(datePeremption: string, today: string): boolean {
  return today >= datePeremption;
}

/** Default expiry of a new lot: date_fabrication + produit.conservation_j. */
export function defaultDatePeremption(dateFabrication: string, conservationJ: number): string {
  return addDays(dateFabrication, conservationJ);
}

/** Postgres timestamptz text ("2026-11-11 10:00:00.123+00") → ISO-8601 UTC. */
export function toIsoTimestamp(value: string | Date): string {
  const d =
    value instanceof Date
      ? value
      : new Date(value.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00'));
  if (Number.isNaN(d.getTime()))
    throw new RangeError(`Invalid timestamp: ${JSON.stringify(value)}`);
  return d.toISOString();
}
