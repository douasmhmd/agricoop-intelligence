// Builds the data plane's analytics layer (schema `gold`) in the local database, exactly as the
// data plane does: the notebooks' ML tables (empty until the notebooks run) + data/bi/01..04_*.sql.
// Usage (repo root): pnpm db:gold     — uses DATABASE_URL from .env (owner connection).
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadGoldLayer } from '../dist/index.js';

const envFile = fileURLToPath(new URL('../../../.env', import.meta.url));
if (!process.env.DATABASE_URL && existsSync(envFile)) process.loadEnvFile(envFile);
const ownerUrl = process.env.DATABASE_URL;
if (!ownerUrl) throw new Error('DATABASE_URL is not set (copy .env.example to .env)');

const readerUrl = await loadGoldLayer({ ownerUrl });
const shown = new URL(readerUrl);
shown.password = '***';
console.warn(`gold layer ready; analytics_reader: ${shown}`);
