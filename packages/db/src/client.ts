import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as relations from './generated/relations.js';
import * as tables from './generated/schema.js';

export const schema = { ...tables, ...relations };
export type Schema = typeof schema;
export type Database = NodePgDatabase<Schema>;

export interface DbConfig {
  connectionString: string;
  /** Pool size (default 10). */
  max?: number;
  /** Shown in pg_stat_activity, e.g. "agricoop-api". */
  applicationName?: string;
  /** Per-statement timeout in ms (default 15 s). */
  statementTimeoutMs?: number;
}

/** Creates a pg pool. Construction is lazy: no connection is opened until the first query. */
export function createPool(config: DbConfig): pg.Pool {
  return new pg.Pool({
    connectionString: config.connectionString,
    max: config.max ?? 10,
    application_name: config.applicationName ?? 'agricoop',
    statement_timeout: config.statementTimeoutMs ?? 15_000,
  });
}

export function createDb(pool: pg.Pool): Database {
  return drizzle(pool, { schema });
}

/** Readiness probe: true when the database answers `SELECT 1`. */
export async function pingDb(pool: Pick<pg.Pool, 'query'>): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

export type { Pool, PoolClient } from 'pg';
