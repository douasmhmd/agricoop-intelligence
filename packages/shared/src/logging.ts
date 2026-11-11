/*
 * Log redaction rules (Law 09-08 / CNDP): personal data, credentials, QR tokens and IP addresses
 * never reach log storage. Used by every service's pino configuration.
 */

const SENSITIVE_KEYS = [
  // client_pii columns
  'nom',
  'telephone',
  'email',
  'adresse',
  // credentials and tokens
  'password',
  'token',
  'access_token',
  'refresh_token',
  'id_token',
  'client_secret',
  'secret',
] as const;

/** pino `redact.paths`: top level, one and two levels deep, plus HTTP headers and client IPs. */
export const LOG_REDACT_PATHS: readonly string[] = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-forwarded-for"]',
  'req.headers["x-real-ip"]',
  'req.headers["cf-connecting-ip"]',
  'req.remoteAddress',
  'req.remotePort',
  'res.headers["set-cookie"]',
  ...SENSITIVE_KEYS,
  ...SENSITIVE_KEYS.map((k) => `*.${k}`),
  ...SENSITIVE_KEYS.map((k) => `*.*.${k}`),
];

export const LOG_REDACT_CENSOR = '[REDACTED]';

/**
 * Removes QR tokens from URLs before they are logged: `/qr/v1/verify/<token>` and the storefront
 * page `/v/<token>` become `.../[REDACTED]`. Query strings are dropped entirely.
 */
export function redactUrl(url: string | undefined): string | undefined {
  if (url === undefined) return undefined;
  const path = url.split('?')[0] ?? '';
  return path.replace(/\/(verify|v)\/[^/]+/g, `/$1/${LOG_REDACT_CENSOR}`);
}
