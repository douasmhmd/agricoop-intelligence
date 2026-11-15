// Replaces the LOCAL dev database with the data plane's shared seed dump (pg_dump custom format:
// all tables, ML outputs, gold views), then re-adds what the apps need on top of it.
//
//   pnpm db:restore -- <path/to/agricoop_seed.dump>
//
// Steps: copy the dump into the Postgres container → drop and recreate `agricoop` → pg_restore →
// apps seeds (COOP02 demo cooperative and catalogue) → gold layer grants (pnpm db:gold).
// The apps' containers reconnect by themselves. DEV ONLY: everything in the local database is lost.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const dump = process.argv.slice(2).find((a) => a !== '--');
if (!dump || !existsSync(dump)) {
  console.error('Usage: pnpm db:restore -- <path/to/agricoop_seed.dump>');
  process.exit(1);
}
const CONTAINER = 'agricoop-postgres';
// pnpm is a .cmd shim on Windows: it needs a shell there.
const run = (cmd, args) =>
  execFileSync(cmd, args, {
    stdio: 'inherit',
    env: { ...process.env, MSYS_NO_PATHCONV: '1' },
    shell: cmd === 'pnpm' && process.platform === 'win32',
  });
const psql = (db, sql) =>
  run('docker', [
    'exec',
    CONTAINER,
    'psql',
    '-v',
    'ON_ERROR_STOP=1',
    '-U',
    'agricoop',
    '-d',
    db,
    '-qc',
    sql,
  ]);

console.warn(`Restoring ${resolve(dump)} into the local database…`);
run('docker', ['cp', resolve(dump), `${CONTAINER}:/tmp/agricoop_seed.dump`]);
psql(
  'postgres',
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'agricoop' AND pid <> pg_backend_pid()",
);
psql('postgres', 'DROP DATABASE IF EXISTS agricoop');
psql('postgres', 'CREATE DATABASE agricoop OWNER agricoop');
run('docker', [
  'exec',
  CONTAINER,
  'pg_restore',
  '-U',
  'agricoop',
  '-d',
  'agricoop',
  '--no-owner',
  '--exit-on-error',
  '/tmp/agricoop_seed.dump',
]);
run('pnpm', ['db:seed']);
run('pnpm', ['db:gold']);
console.warn('Done: shared seed restored, apps seeds and gold grants applied.');
