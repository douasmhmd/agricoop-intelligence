import { cooperative, type Database } from '@agricoop/db';
import { eq } from 'drizzle-orm';

/** Answers "does this cooperative exist?" for saas_admin tenant overrides. */
export interface TenantDirectory {
  exists(coopId: string): Promise<boolean>;
}

export const TENANT_DIRECTORY = Symbol.for('agricoop.TENANT_DIRECTORY');

/** `cooperative` is not tenant-private (readable by the app role under RLS proposal 001). */
export function createDbTenantDirectory(db: Database): TenantDirectory {
  return {
    async exists(coopId: string): Promise<boolean> {
      const rows = await db
        .select({ id: cooperative.coop_id })
        .from(cooperative)
        .where(eq(cooperative.coop_id, coopId))
        .limit(1);
      return rows.length > 0;
    },
  };
}
