import { createPool, pingDb } from '@agricoop/db';
import { LOG_REDACT_CENSOR, LOG_REDACT_PATHS } from '@agricoop/shared';
import pino from 'pino';
import { collectDefaultMetrics, Registry } from 'prom-client';
import { loadEnv } from './env';
import { createProbeServer } from './http';
import { createRelayMetrics, RelayLoop } from './relay';

function main(): void {
  const env = loadEnv();
  const logger = pino({
    name: 'agricoop-outbox-relay',
    level: env.LOG_LEVEL,
    redact: { paths: [...LOG_REDACT_PATHS], censor: LOG_REDACT_CENSOR },
  });

  const pool = createPool({
    connectionString: env.DATABASE_URL,
    applicationName: 'agricoop-outbox-relay',
    max: 2,
  });
  const registry = new Registry();
  registry.setDefaultLabels({ service: 'agricoop-outbox-relay' });
  collectDefaultMetrics({ register: registry });
  createRelayMetrics(registry);

  const loop = new RelayLoop({
    pollIntervalMs: env.POLL_INTERVAL_MS,
    logger,
    // Phase 5: claim a batch of unpublished outbox rows and publish them to Redpanda.
    tick: () => Promise.resolve(),
  });

  const server = createProbeServer({ registry, readiness: { database: () => pingDb(pool) } });
  server.listen(env.PORT, '0.0.0.0', () => {
    logger.info({ port: env.PORT }, 'outbox relay started');
  });
  loop.start();

  const shutdown = (signal: string): void => {
    logger.info({ signal }, 'outbox relay stopping');
    void loop
      .stop()
      .then(() => new Promise<void>((resolve) => server.close(() => resolve())))
      .then(() => pool.end())
      .finally(() => process.exit(0));
  };
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}

main();
