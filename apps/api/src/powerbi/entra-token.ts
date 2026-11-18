import { ConfidentialClientApplication } from '@azure/msal-node';
import type { PowerBiConfig } from './config';

/** Microsoft Entra ID access token for the Power BI REST API (client-credentials flow). */
export interface AccessTokenProvider {
  token(): Promise<string>;
}

export const POWERBI_SCOPE = 'https://analysis.windows.net/powerbi/api/.default';
/** Renew this long before expiry, so a request never starts with a token about to lapse. */
const RENEW_BEFORE_MS = 5 * 60_000;

export class EntraTokenProvider implements AccessTokenProvider {
  private readonly app: ConfidentialClientApplication;
  private cached?: { value: string; expiresAt: number };
  private pending?: Promise<string>;

  constructor(
    config: Pick<PowerBiConfig, 'tenantId' | 'clientId' | 'clientSecret' | 'authorityHost'>,
    private readonly now: () => number = Date.now,
  ) {
    this.app = new ConfidentialClientApplication({
      auth: {
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        authority: `${config.authorityHost}/${config.tenantId}`,
      },
    });
  }

  async token(): Promise<string> {
    if (this.cached && this.cached.expiresAt - RENEW_BEFORE_MS > this.now()) {
      return this.cached.value;
    }
    // One request at a time: concurrent callers share the same renewal.
    this.pending ??= this.acquire().finally(() => {
      this.pending = undefined;
    });
    return this.pending;
  }

  private async acquire(): Promise<string> {
    const result = await this.app.acquireTokenByClientCredential({ scopes: [POWERBI_SCOPE] });
    if (!result?.accessToken) throw new Error('Entra ID returned no access token');
    this.cached = {
      value: result.accessToken,
      expiresAt: result.expiresOn?.getTime() ?? this.now() + 30 * 60_000,
    };
    return result.accessToken;
  }
}
