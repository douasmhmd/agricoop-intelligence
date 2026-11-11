import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
export const SCHEMA_SQL_PATH = `${repoRoot}contracts/db/schema.sql`;
export const RLS_PROPOSAL_PATH = `${repoRoot}contracts/db/proposals/001_rls.sql`;

export interface TestDatabase {
  /** Owner connection (bypasses RLS): use it to seed fixtures. */
  ownerUrl: string;
  /** Connection the application under test uses: owner without RLS, `agricoop_app` member with RLS. */
  appUrl: string;
  rls: boolean;
  stop(): Promise<void>;
}

export interface TestDatabaseOptions {
  /** Apply contracts/db/proposals/001_rls.sql and connect the app as a non-owner role. */
  rls?: boolean;
}

/** Postgres 16 in a container, loaded with contracts/db/schema.sql exactly as the root compose does. */
export async function startTestDatabase(options: TestDatabaseOptions = {}): Promise<TestDatabase> {
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer('postgres:16')
    .withDatabase('agricoop')
    .withUsername('agricoop')
    .withPassword('test-only')
    .withCopyFilesToContainer([
      { source: SCHEMA_SQL_PATH, target: '/docker-entrypoint-initdb.d/01_schema.sql' },
    ])
    .start();

  const ownerUrl = container.getConnectionUri();
  let appUrl = ownerUrl;

  if (options.rls) {
    const client = new pg.Client({ connectionString: ownerUrl });
    await client.connect();
    try {
      await client.query(readFileSync(RLS_PROPOSAL_PATH, 'utf8'));
      await client.query(`CREATE ROLE app_test LOGIN PASSWORD 'test-only' IN ROLE agricoop_app`);
    } finally {
      await client.end();
    }
    const url = new URL(ownerUrl);
    url.username = 'app_test';
    url.password = 'test-only';
    appUrl = url.toString();
  }

  return {
    ownerUrl,
    appUrl,
    rls: options.rls ?? false,
    stop: async () => {
      await container.stop();
    },
  };
}

/** Runs SQL as the owner (fixtures). */
export async function ownerQuery<R extends pg.QueryResultRow = pg.QueryResultRow>(
  db: TestDatabase,
  text: string,
  values: unknown[] = [],
): Promise<R[]> {
  const client = new pg.Client({ connectionString: db.ownerUrl });
  await client.connect();
  try {
    return (await client.query<R>(text, values)).rows;
  } finally {
    await client.end();
  }
}
