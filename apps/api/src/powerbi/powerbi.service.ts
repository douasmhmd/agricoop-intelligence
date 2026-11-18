import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppProblem, hasRole, RequestContext } from '@agricoop/nest-kit';
import type { PowerBiEmbed, PowerBiReports, PowerBiRlsRole } from '@agricoop/shared';
import type { PowerBiConfig } from './config';
import {
  type EffectiveIdentity,
  POWERBI_API,
  type PowerBiApi,
  PowerBiApiError,
  type PowerBiReportInfo,
} from './powerbi.client';

export const POWERBI_CONFIG = Symbol('POWERBI_CONFIG');
/** Names of the missing settings, reported in demo mode. */
export const POWERBI_MISSING = Symbol('POWERBI_MISSING');

/** Report metadata (embed URL, dataset, page titles) changes rarely: cache it a few minutes. */
const METADATA_TTL_MS = 10 * 60_000;

const unknownReport = () =>
  new AppProblem(
    404,
    'rapport_powerbi_inconnu',
    'Unknown report',
    'No Power BI report with this key',
  );
const unavailable = () =>
  new AppProblem(
    502,
    'powerbi_indisponible',
    'Power BI unavailable',
    'Power BI did not answer as expected; try again later',
  );

@Injectable()
export class PowerBiService {
  private readonly logger = new Logger('PowerBi');
  private readonly cache = new Map<string, { value: unknown; until: number }>();

  constructor(
    @Inject(POWERBI_CONFIG) private readonly config: PowerBiConfig | undefined,
    @Inject(POWERBI_MISSING) private readonly missing: string[],
    @Inject(POWERBI_API) private readonly api: PowerBiApi | undefined,
  ) {}

  private live(): { config: PowerBiConfig; api: PowerBiApi } | undefined {
    return this.config && this.api ? { config: this.config, api: this.api } : undefined;
  }

  async reports(): Promise<PowerBiReports> {
    const live = this.live();
    if (!live) return { mode: 'demo', reports: [], missing: this.missing };
    const { config, api } = live;
    try {
      const reports = await Promise.all(
        Object.entries(config.reports).map(async ([key, entry]) => {
          const report = await this.report(api, config.workspaceId, entry.reportId);
          const title =
            entry.title ??
            (entry.page
              ? (await this.pages(api, config.workspaceId, entry.reportId)).find(
                  (p) => p.name === entry.page,
                )?.displayName
              : undefined) ??
            report.name;
          const lastRefresh = await this.cached(`refresh:${report.datasetId}`, () =>
            api.getLastRefresh(config.workspaceId, report.datasetId),
          );
          return { key, title, pageName: entry.page ?? null, lastRefresh };
        }),
      );
      return { mode: 'live', reports, missing: [] };
    } catch (error) {
      throw this.upstream(error, 'reports');
    }
  }

  /**
   * Embed token for one report, scoped by row-level security. The cooperative comes from the
   * request context (token tenant, or X-Coop-Id for a saas_admin, both checked by AccessGuard),
   * never from the request itself. A saas_admin without X-Coop-Id gets the unfiltered Admin role.
   */
  async embed(reportKey: string): Promise<PowerBiEmbed> {
    const live = this.live();
    if (!live) return { mode: 'demo', embed: null, missing: this.missing };
    const { config, api } = live;
    if (!Object.hasOwn(config.reports, reportKey)) throw unknownReport();
    const entry = config.reports[reportKey]!;

    const context = RequestContext.current();
    const coopId = context?.coopId;
    let rls: PowerBiRlsRole;
    let username: string;
    if (coopId) {
      rls = 'Cooperative';
      username = coopId;
    } else if (hasRole(context?.user, 'saas_admin')) {
      // Cross-tenant view for the platform admin (route opted in with @AdminTenantOptional).
      rls = 'Admin';
      username = 'agricoop-platform-admin';
    } else {
      // AccessGuard guarantees a tenant for everyone else: refuse rather than embed unfiltered.
      throw new AppProblem(403, 'tenant_required', 'Tenant required', 'No cooperative in context');
    }

    try {
      const report = await this.report(api, config.workspaceId, entry.reportId);
      const identity: EffectiveIdentity = {
        username,
        roles: [rls],
        datasets: [report.datasetId],
      };
      const token = await api.generateToken({
        datasets: [{ id: report.datasetId, xmlaPermissions: 'Off' }],
        reports: [{ id: report.id, allowEdit: false }],
        targetWorkspaces: [],
        identities: [identity],
        lifetimeInMinutes: config.tokenMinutes,
      });
      // Never log the token. coop_id is not personal data.
      this.logger.log({
        msg: 'embed token issued',
        report: reportKey,
        rls,
        coop_id: coopId ?? null,
      });
      return {
        mode: 'live',
        embed: {
          reportKey,
          reportId: report.id,
          pageName: entry.page ?? null,
          embedUrl: report.embedUrl,
          embedToken: token.token,
          expiresAt: new Date(token.expiration).toISOString(),
          rls,
        },
        missing: [],
      };
    } catch (error) {
      throw this.upstream(error, reportKey);
    }
  }

  private report(api: PowerBiApi, workspaceId: string, reportId: string) {
    return this.cached<PowerBiReportInfo>(`report:${reportId}`, () =>
      api.getReport(workspaceId, reportId),
    );
  }

  private pages(api: PowerBiApi, workspaceId: string, reportId: string) {
    return this.cached(`pages:${reportId}`, () => api.getPages(workspaceId, reportId));
  }

  private async cached<T>(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.cache.get(key);
    if (hit && hit.until > Date.now()) return hit.value as T;
    const value = await load();
    this.cache.set(key, { value, until: Date.now() + METADATA_TTL_MS });
    return value;
  }

  private upstream(error: unknown, what: string): Error {
    if (error instanceof AppProblem) return error;
    this.logger.warn({
      msg: 'Power BI call failed',
      what,
      status: error instanceof PowerBiApiError ? error.status : undefined,
      error: error instanceof Error ? error.message : String(error),
    });
    return unavailable();
  }
}
