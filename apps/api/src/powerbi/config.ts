import { powerBiReportKey } from '@agricoop/shared';
import { z } from 'zod';

/*
 * Power BI settings (env, see .env.example and docs/powerbi-embedding.md). All of the required
 * settings or none: none = demo mode (local dev, CI); some but not all = startup error.
 */

export const POWERBI_REQUIRED = [
  'POWERBI_TENANT_ID',
  'POWERBI_CLIENT_ID',
  'POWERBI_CLIENT_SECRET',
  'POWERBI_WORKSPACE_ID',
  'POWERBI_REPORTS',
] as const;

/**
 * POWERBI_REPORTS: JSON object, key → report id, or → { reportId, page?, title? } to open one page
 * of a multi-page report (the data plane's AgriCoop_Dashboard has several pages).
 */
const reportEntry = z.union([
  z.uuid().transform((reportId) => ({ reportId })),
  z.object({
    reportId: z.uuid(),
    page: z.string().min(1).optional(),
    title: z.string().min(1).optional(),
  }),
]);
export const powerBiReportsMap = z
  .record(powerBiReportKey, reportEntry)
  .refine((m) => Object.keys(m).length > 0, 'at least one report');

const json = z.string().transform((text, ctx) => {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    ctx.addIssue({ code: 'custom', message: 'must be valid JSON' });
    return z.NEVER;
  }
});

/** Compose passes unset variables as '': treat them as absent (demo mode). */
const unset = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === '' ? undefined : v), schema.optional());

export const powerBiEnvShape = {
  POWERBI_TENANT_ID: unset(z.uuid()),
  POWERBI_CLIENT_ID: unset(z.uuid()),
  POWERBI_CLIENT_SECRET: unset(z.string().min(1)),
  POWERBI_WORKSPACE_ID: unset(z.uuid()),
  POWERBI_REPORTS: unset(json.pipe(powerBiReportsMap)),
  /** Public cloud by default; sovereign clouds use other hosts. */
  POWERBI_API_URL: z.url().default('https://api.powerbi.com/v1.0/myorg'),
  POWERBI_AUTHORITY_HOST: z.url().default('https://login.microsoftonline.com'),
  /** Embed token lifetime asked of Power BI (it may grant less). */
  POWERBI_TOKEN_MINUTES: z.coerce.number().int().min(10).max(60).default(60),
};

type PowerBiEnv = z.infer<z.ZodObject<typeof powerBiEnvShape>>;

/** Startup check: all required settings or none. */
export function missingPowerBiSettings(env: Partial<PowerBiEnv>): string[] {
  return POWERBI_REQUIRED.filter((k) => env[k] === undefined);
}
export function powerBiAllOrNone(env: Partial<PowerBiEnv>): boolean {
  const missing = missingPowerBiSettings(env).length;
  return missing === 0 || missing === POWERBI_REQUIRED.length;
}

export interface PowerBiReportConfig {
  reportId: string;
  page?: string;
  title?: string;
}

export interface PowerBiConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  workspaceId: string;
  reports: Record<string, PowerBiReportConfig>;
  apiUrl: string;
  authorityHost: string;
  tokenMinutes: number;
}

/** The live configuration, or undefined in demo mode. */
export function powerBiConfig(env: PowerBiEnv): PowerBiConfig | undefined {
  if (
    !env.POWERBI_TENANT_ID ||
    !env.POWERBI_CLIENT_ID ||
    !env.POWERBI_CLIENT_SECRET ||
    !env.POWERBI_WORKSPACE_ID ||
    !env.POWERBI_REPORTS
  )
    return undefined;
  return {
    tenantId: env.POWERBI_TENANT_ID,
    clientId: env.POWERBI_CLIENT_ID,
    clientSecret: env.POWERBI_CLIENT_SECRET,
    workspaceId: env.POWERBI_WORKSPACE_ID,
    reports: env.POWERBI_REPORTS,
    apiUrl: env.POWERBI_API_URL.replace(/\/$/, ''),
    authorityHost: env.POWERBI_AUTHORITY_HOST.replace(/\/$/, ''),
    tokenMinutes: env.POWERBI_TOKEN_MINUTES,
  };
}
