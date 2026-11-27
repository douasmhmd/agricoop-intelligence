import { ConfidentialClientApplication } from '@azure/msal-node';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EntraTokenProvider } from '../src/powerbi/entra-token';

const config = {
  tenantId: '44444444-4444-4444-8444-444444444444',
  clientId: '55555555-5555-4555-8555-555555555555',
  clientSecret: 'secret',
  authorityHost: 'https://login.microsoftonline.com',
};

describe('EntraTokenProvider', () => {
  afterEach(() => vi.restoreAllMocks());

  it('reuses the token until 5 minutes before expiry, one renewal at a time', async () => {
    let now = Date.parse('2026-11-18T10:00:00Z');
    let issued = 0;
    const acquire = vi
      .spyOn(ConfidentialClientApplication.prototype, 'acquireTokenByClientCredential')
      .mockImplementation(() => {
        issued += 1;
        return Promise.resolve({
          accessToken: `token-${issued}`,
          expiresOn: new Date(now + 60 * 60_000),
        } as never); // justification: only accessToken / expiresOn are read
      });
    const provider = new EntraTokenProvider(config, () => now);

    // Concurrent first calls share one request.
    expect(await Promise.all([provider.token(), provider.token()])).toEqual(['token-1', 'token-1']);
    expect(acquire).toHaveBeenCalledTimes(1);
    expect(acquire.mock.calls[0]?.[0]).toEqual({
      scopes: ['https://analysis.windows.net/powerbi/api/.default'],
    });

    now += 54 * 60_000; // 6 minutes left: still cached
    expect(await provider.token()).toBe('token-1');
    now += 2 * 60_000; // 4 minutes left: renewed
    expect(await provider.token()).toBe('token-2');
    expect(acquire).toHaveBeenCalledTimes(2);
  });

  it('fails clearly when Entra ID returns no token', async () => {
    vi.spyOn(
      ConfidentialClientApplication.prototype,
      'acquireTokenByClientCredential',
    ).mockResolvedValue(null);
    await expect(new EntraTokenProvider(config).token()).rejects.toThrow(/no access token/);
  });
});
