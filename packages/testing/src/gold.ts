import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import type { TestDatabase } from './postgres.js';

/*
 * The data plane's analytics layer, built exactly as the data plane builds it:
 * - the ML tables (gold.segment_client, gold.alerte_qr) with the DDL written in the notebooks
 *   (data/ml/*.ipynb), extracted at run time so the test never drifts from it;
 * - the gold views, function and read-only role from data/bi/01..04_*.sql, unchanged.
 */
const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const BI_FILES = [
  '01_gold_ventes.sql',
  '02_gold_stocks.sql',
  '03_gold_previsions_marges.sql',
  '04_role_lecture.sql',
];
const ML_NOTEBOOKS = ['02_segmentation_clients.ipynb', '03_detection_copies_qr.ipynb'];

/** `create table if not exists gold.*` statements found in the data plane's notebooks. */
export function mlTableDdl(): string[] {
  return ML_NOTEBOOKS.flatMap((file) => {
    const nb = JSON.parse(readFileSync(`${repoRoot}data/ml/${file}`, 'utf8')) as {
      cells: { source: string[] | string }[];
    };
    const code = nb.cells
      .map((c) => (Array.isArray(c.source) ? c.source.join('') : c.source))
      .join('\n');
    return [...code.matchAll(/create table if not exists gold\.\w+ \([\s\S]*?\n\);/g)].map(
      (m) => m[0],
    );
  });
}

/**
 * Builds the gold layer in a test database. Returns a connection URL for `analytics_reader`
 * (the role created by data/bi/04_role_lecture.sql; its password there is a local default).
 */
export async function loadGoldLayer(db: Pick<TestDatabase, 'ownerUrl'>): Promise<string> {
  const client = new pg.Client({ connectionString: db.ownerUrl });
  await client.connect();
  try {
    await client.query('create schema if not exists gold');
    for (const ddl of mlTableDdl()) await client.query(ddl);
    for (const file of BI_FILES) {
      await client.query(readFileSync(`${repoRoot}data/bi/${file}`, 'utf8'));
    }
  } finally {
    await client.end();
  }
  const url = new URL(db.ownerUrl);
  url.username = 'analytics_reader';
  url.password = 'analytics_dev';
  return url.toString();
}
