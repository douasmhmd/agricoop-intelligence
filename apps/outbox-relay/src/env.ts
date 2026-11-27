import { z } from 'zod';

export const relayEnv = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.url(),
  /** Comma-separated Kafka API brokers (Redpanda). */
  KAFKA_BROKERS: z
    .string()
    .default('localhost:19092')
    .transform((v) => v.split(',').map((s) => s.trim())),
  /** Port of the health / metrics HTTP server. */
  PORT: z.coerce.number().int().positive().default(3002),
  POLL_INTERVAL_MS: z.coerce.number().int().min(50).default(1000),
  BATCH_SIZE: z.coerce.number().int().min(1).max(1000).default(100),
  /** Used only when the relay creates missing topics at startup. */
  TOPIC_PARTITIONS: z.coerce.number().int().min(1).default(3),
  TOPIC_REPLICATION: z.coerce.number().int().min(1).default(1),
});
export type RelayEnv = z.infer<typeof relayEnv>;

export function loadEnv(source: Record<string, string | undefined> = process.env): RelayEnv {
  const result = relayEnv.safeParse(source);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`);
  }
  return result.data;
}
