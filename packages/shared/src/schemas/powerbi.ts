import { z } from 'zod';
import { uuid } from './common.js';

/*
 * Power BI Embedded ("embed for your customers"): the API holds the service principal and returns a
 * short-lived embed token scoped by row-level security. Without POWERBI_* settings the endpoints
 * answer in demo mode, listing the missing settings (names only), so local dev and CI need no Azure.
 */

/** Report keys in the URL and in POWERBI_REPORTS: short slugs. */
export const powerBiReportKey = z.string().regex(/^[a-z0-9_-]{1,32}$/);
export const powerBiReportKeyParam = z.object({ reportKey: powerBiReportKey });

/** Row-level security roles of the semantic model (see docs/powerbi-embedding.md). */
export const POWERBI_RLS_ROLES = ['Cooperative', 'Admin'] as const;
export type PowerBiRlsRole = (typeof POWERBI_RLS_ROLES)[number];

/** live: Power BI is configured. demo: it is not (`missing` lists the settings to provide). */
export const POWERBI_MODES = ['live', 'demo'] as const;
const mode = z.enum(POWERBI_MODES);
/** Settings to provide to enable Power BI (names only, never values); empty in live mode. */
const missing = z.array(z.string());

export const powerBiReportSchema = z.object({
  key: powerBiReportKey,
  title: z.string(),
  /** Report page to open (a key can target one page of a multi-page report). */
  pageName: z.string().nullable(),
  /** End of the last completed dataset refresh, when Power BI reports one. */
  lastRefresh: z.iso.datetime({ offset: true }).nullable(),
});
export type PowerBiReport = z.infer<typeof powerBiReportSchema>;

export const powerBiReportsSchema = z.object({
  mode,
  reports: z.array(powerBiReportSchema),
  missing,
});
export type PowerBiReports = z.infer<typeof powerBiReportsSchema>;

export const powerBiEmbedConfigSchema = z.object({
  reportKey: powerBiReportKey,
  reportId: uuid,
  pageName: z.string().nullable(),
  embedUrl: z.url(),
  embedToken: z.string(),
  expiresAt: z.iso.datetime({ offset: true }),
  /** RLS role the token carries: Cooperative (filtered on the caller's coop_id) or Admin. */
  rls: z.enum(POWERBI_RLS_ROLES),
});
export type PowerBiEmbedConfig = z.infer<typeof powerBiEmbedConfigSchema>;

/** `embed` is set in live mode, null in demo mode. */
export const powerBiEmbedSchema = z.object({
  mode,
  embed: powerBiEmbedConfigSchema.nullable(),
  missing,
});
export type PowerBiEmbed = z.infer<typeof powerBiEmbedSchema>;
