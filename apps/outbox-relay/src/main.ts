import { createPool, pingDb } from '@agricoop/db';
import { LOG_REDACT_CENSOR, LOG_REDACT_PATHS } from '@agricoop/shared';
import pino from 'pino';
import { collectDefaultMetrics, Registry } from 'prom-client';
import { loadEnv } from './env';
import { createProbeServer } from './http';
import { createKafkaPublisher } from './kafka';
import { createRelayMetrics, refreshLagMetrics, relayBatch, RelayLoop } from './relay';

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = pino({
    name: 'agricoop-outbox-relay',
    level: env.LOG_LEVEL,
    redact: { paths: [...LOG_REDACT_PATHS], censor: LOG_REDACT_CENSOR },
  });

  const pool = createPool({
    connectionString: env.DATABASE_URL,
    applicationName: 'agricoop-outbox-relay',
    max: 4,
  });
  const registry = new Registry();
  registry.setDefaultLabels({ service: 'agricoop-outbox-relay' });
  collectDefaultMetrics({ register: registry });
  const metrics = createRelayMetrics(registry);

  const publisher = await createKafkaPublisher({ brokers: env.KAFKA_BROKERS, logger });
  await publisher.ensureTopics(env.TOPIC_PARTITIONS, env.TOPIC_REPLICATION);

  const loop = new RelayLoop({
    pollIntervalMs: env.POLL_INTERVAL_MS,
    logger,
    tick: async () => {
      const handled = await relayBatch({
        pool,
        publisher,
        batchSize: env.BATCH_SIZE,
        logger,
        metrics,
      });
      await refreshLagMetrics(pool, metrics);
      return handled;
    },
  });

  const server = createProbeServer({
    registry,
    readiness: {
      database: () => pingDb(pool),
      redpanda: () => Promise.resolve(publisher.connected()),
    },
  });
  server.listen(env.PORT, '0.0.0.0', () => {
    logger.info({ port: env.PORT, brokers: env.KAFKA_BROKERS.length }, 'outbox relay started');
  });
  loop.start();

  const shutdown = (signal: string): void => {
    logger.info({ signal }, 'outbox relay stopping');
    void loop
      .stop()
      .then(() => publisher.disconnect())
      .then(() => new Promise<void>((resolve) => server.close(() => resolve())))
      .then(() => pool.end())
      .finally(() => process.exit(0));
  };
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error: unknown) => {
  console.error('outbox relay failed to start', error instanceof Error ? error.message : error);
  process.exit(1);
});
