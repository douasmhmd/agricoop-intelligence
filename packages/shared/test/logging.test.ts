import { describe, expect, it } from 'vitest';
import { LOG_REDACT_PATHS, redactUrl } from '../src/index.js';

describe('redactUrl', () => {
  it('removes QR tokens from verification URLs', () => {
    expect(redactUrl('/qr/v1/verify/AbC_dEf-123')).toBe('/qr/v1/verify/[REDACTED]');
    expect(redactUrl('/v/AbC_dEf-123')).toBe('/v/[REDACTED]');
  });

  it('drops query strings', () => {
    expect(redactUrl('/api/v1/commandes?email=a@b.ma')).toBe('/api/v1/commandes');
  });

  it('leaves other URLs untouched', () => {
    expect(redactUrl('/api/v1/coops/COOP01/produits')).toBe('/api/v1/coops/COOP01/produits');
    expect(redactUrl(undefined)).toBeUndefined();
  });
});

describe('LOG_REDACT_PATHS', () => {
  it('covers client_pii columns, auth headers and client IPs', () => {
    for (const key of ['nom', 'telephone', 'email', 'adresse']) {
      expect(LOG_REDACT_PATHS).toContain(key);
      expect(LOG_REDACT_PATHS).toContain(`*.${key}`);
    }
    expect(LOG_REDACT_PATHS).toContain('req.headers.authorization');
    expect(LOG_REDACT_PATHS).toContain('req.remoteAddress');
  });
});
