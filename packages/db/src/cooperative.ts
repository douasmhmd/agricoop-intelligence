import { eq } from 'drizzle-orm';
import type { Database } from './client.js';
import { cooperative } from './generated/schema.js';

export type CooperativeRow = typeof cooperative.$inferSelect;

/**
 * Public lookup of a cooperative by its code (storefront URLs /coops/:code). `cooperative` is not
 * tenant-private: readable by the app role under RLS proposal 001.
 */
export async function findCooperativeByCode(
  db: Database,
  code: string,
): Promise<CooperativeRow | undefined> {
  const [row] = await db.select().from(cooperative).where(eq(cooperative.code, code)).limit(1);
  return row;
}

export async function listCooperatives(db: Database): Promise<CooperativeRow[]> {
  return db.select().from(cooperative).orderBy(cooperative.code);
}
