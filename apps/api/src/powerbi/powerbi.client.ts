import type { AccessTokenProvider } from './entra-token';

/**
 * The few Power BI REST calls the embedding needs, behind a port: tests replace it with a fake
 * (no Azure in CI) and assert on the GenerateToken request, in particular the effective identity.
 */
export interface PowerBiApi {
  getReport(workspaceId: string, reportId: string): Promise<PowerBiReportInfo>;
  getPages(workspaceId: string, reportId: string): Promise<{ name: string; displayName: string }[]>;
  /** End of the last completed refresh of a dataset, or null. */
  getLastRefresh(workspaceId: string, datasetId: string): Promise<string | null>;
  generateToken(request: GenerateTokenRequest): Promise<{ token: string; expiration: string }>;
}

export const POWERBI_API = Symbol('POWERBI_API');

export interface PowerBiReportInfo {
  id: string;
  name: string;
  embedUrl: string;
  datasetId: string;
}

/** POST /GenerateToken (multi-resource, v2) body. */
export interface GenerateTokenRequest {
  datasets: { id: string; xmlaPermissions: 'Off' }[];
  reports: { id: string; allowEdit: false }[];
  targetWorkspaces: { id: string }[];
  identities: EffectiveIdentity[];
  lifetimeInMinutes: number;
}

export interface EffectiveIdentity {
  username: string;
  roles: string[];
  datasets: string[];
}

export class PowerBiApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export class RestPowerBiApi implements PowerBiApi {
  constructor(
    private readonly baseUrl: string,
    private readonly tokens: AccessTokenProvider,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  getReport(workspaceId: string, reportId: string): Promise<PowerBiReportInfo> {
    return this.call<PowerBiReportInfo>('GET', `/groups/${workspaceId}/reports/${reportId}`);
  }

  async getPages(workspaceId: string, reportId: string) {
    const res = await this.call<{ value: { name: string; displayName: string }[] }>(
      'GET',
      `/groups/${workspaceId}/reports/${reportId}/pages`,
    );
    return res.value;
  }

  async getLastRefresh(workspaceId: string, datasetId: string): Promise<string | null> {
    const res = await this.call<{ value: { status: string; endTime?: string }[] }>(
      'GET',
      `/groups/${workspaceId}/datasets/${datasetId}/refreshes?$top=5`,
    );
    return res.value.find((r) => r.status === 'Completed' && r.endTime)?.endTime ?? null;
  }

  generateToken(request: GenerateTokenRequest) {
    return this.call<{ token: string; expiration: string }>('POST', '/GenerateToken', request);
  }

  private async call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${await this.tokens.token()}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      // Power BI error bodies can echo request details: keep only the status and the error code.
      const code = await response
        .json()
        .then((b: unknown) => (b as { error?: { code?: string } }).error?.code)
        .catch(() => undefined);
      throw new PowerBiApiError(
        response.status,
        `Power BI ${method} ${path.split('?')[0]} → ${response.status}${code ? ` ${code}` : ''}`,
      );
    }
    return (await response.json()) as T;
  }
}
