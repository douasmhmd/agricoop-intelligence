import {
  assertValidEvent,
  CURRENT_EVENT_VERSION,
  EVENT_TYPES,
  type EventEnvelope,
  type EventType,
  InvalidEventError,
  topicFor,
} from '@agricoop/events';
import type { Pool } from 'pg';
import type { Logger } from 'pino';
import { Counter, Gauge, type Registry } from 'prom-client';

/** Events that cannot be published as-is (unknown type, invalid payload) go here, WITHOUT payload. */
export const DEAD_LETTER_TOPIC = 'agricoop.dead_letter.v1';

export interface OutboundMessage {
  topic: string;
  /** coop_id: all events of a cooperative land in the same partition, in order. */
  key: string;
  value: string;
  headers: Record<string, string>;
}

/** Publishing port (Kafka/Redpanda in production, fakes in tests). Must resolve only once acked. */
export interface EventPublisher {
  publish(messages: OutboundMessage[]): Promise<void>;
}

export interface RelayMetrics {
  published: Counter<'type'>;
  deadLettered: Counter<'type'>;
  lagSeconds: Gauge;
  pending: Gauge;
}

export function createRelayMetrics(registry: Registry): RelayMetrics {
  return {
    published: new Counter({
      name: 'outbox_events_published_total',
      help: 'Outbox events published to Redpanda',
      labelNames: ['type'] as const,
      registers: [registry],
    }),
    deadLettered: new Counter({
      name: 'outbox_events_dead_lettered_total',
      help: 'Outbox events sent to the dead-letter topic',
      labelNames: ['type'] as const,
      registers: [registry],
    }),
    lagSeconds: new Gauge({
      name: 'outbox_lag_seconds',
      help: 'Age of the oldest unpublished outbox row, in seconds',
      registers: [registry],
    }),
    pending: new Gauge({
      name: 'outbox_pending_events',
      help: 'Number of unpublished outbox rows',
      registers: [registry],
    }),
  };
}

/** An outbox row as JSON (to_jsonb), so optional columns of proposal 002 are picked up if present. */
interface OutboxJson {
  event_id: string;
  coop_id: string;
  type: string;
  payload: unknown;
  created_at: string;
  version?: number;
  is_synthetic?: boolean;
  published_at?: string | null;
}

/** Builds the published envelope from an outbox row (contracts/events/README.md). */
export function toEnvelope(row: OutboxJson): EventEnvelope {
  return {
    event_id: row.event_id,
    type: row.type as EventType,
    version: row.version ?? CURRENT_EVENT_VERSION,
    coop_id: row.coop_id,
    occurred_at: new Date(row.created_at).toISOString(),
    is_synthetic: row.is_synthetic ?? false,
    payload: row.payload,
  };
}

function toMessage(row: OutboxJson): { message: OutboundMessage; deadLetter: boolean } {
  const envelope = toEnvelope(row);
  const headers = {
    event_id: envelope.event_id,
    type: row.type,
    version: String(envelope.version),
  };
  try {
    if (!(EVENT_TYPES as readonly string[]).includes(row.type)) {
      throw new InvalidEventError(row.type, ['unknown event type']);
    }
    assertValidEvent(envelope as EventEnvelope & Record<string, unknown>);
    return {
      message: {
        topic: topicFor(envelope.type, envelope.version),
        key: row.coop_id,
        value: JSON.stringify(envelope),
        headers,
      },
      deadLetter: false,
    };
  } catch (error) {
    // The payload is NOT forwarded: an invalid payload might be the very thing that leaks data.
    const reasons = error instanceof InvalidEventError ? error.problems : ['invalid event'];
    return {
      message: {
        topic: DEAD_LETTER_TOPIC,
        key: row.coop_id,
        value: JSON.stringify({ ...envelope, payload: null, errors: reasons }),
        headers,
      },
      deadLetter: true,
    };
  }
}

export interface RelayBatchOptions {
  pool: Pick<Pool, 'connect'>;
  publisher: EventPublisher;
  batchSize: number;
  logger: Logger;
  metrics?: RelayMetrics;
}

/**
 * Publishes one batch of unpublished outbox rows. In ONE transaction: claim rows with
 * FOR UPDATE SKIP LOCKED (concurrent relays never take the same rows), publish, mark `publie`.
 * If publishing fails the transaction rolls back and the rows are retried later: at-least-once.
 *
 * Returns the number of rows handled.
 */
export async function relayBatch(options: RelayBatchOptions): Promise<number> {
  const client = await options.pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<{ row: OutboxJson }>(
      `SELECT to_jsonb(o) AS row FROM outbox o
        WHERE NOT o.publie
        ORDER BY o.created_at, o.event_id
        LIMIT $1
        FOR UPDATE SKIP LOCKED`,
      [options.batchSize],
    );
    if (rows.length === 0) {
      await client.query('COMMIT');
      return 0;
    }
    const built = rows.map((r) => ({ row: r.row, ...toMessage(r.row) }));
    await options.publisher.publish(built.map((b) => b.message));

    const ids = built.map((b) => b.row.event_id);
    const hasPublishedAt = 'published_at' in (rows[0]?.row ?? {});
    await client.query(
      hasPublishedAt
        ? 'UPDATE outbox SET publie = true, published_at = now() WHERE event_id = ANY($1::uuid[])'
        : 'UPDATE outbox SET publie = true WHERE event_id = ANY($1::uuid[])',
      [ids],
    );
    await client.query('COMMIT');

    for (const b of built) {
      if (b.deadLetter) {
        options.metrics?.deadLettered.inc({ type: b.row.type });
        options.logger.error({ event_id: b.row.event_id, type: b.row.type }, 'event dead-lettered');
      } else {
        options.metrics?.published.inc({ type: b.row.type });
      }
    }
    return rows.length;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Refreshes the lag / pending gauges. */
export async function refreshLagMetrics(
  pool: Pick<Pool, 'query'>,
  metrics: RelayMetrics,
): Promise<void> {
  const { rows } = await pool.query<{ pending: number; lag: number }>(
    `SELECT count(*)::int AS pending,
            coalesce(extract(epoch FROM now() - min(created_at)), 0)::float8 AS lag
       FROM outbox WHERE NOT publie`,
  );
  metrics.pending.set(rows[0]?.pending ?? 0);
  metrics.lagSeconds.set(rows[0]?.lag ?? 0);
}

export interface RelayOptions {
  pollIntervalMs: number;
  logger: Logger;
  /** One iteration; returns how many rows it handled (the loop drains without waiting while > 0). */
  tick: () => Promise<number>;
}

/** Polling loop with graceful stop. Iterations never overlap; drains backlogs without sleeping. */
export class RelayLoop {
  private timer: NodeJS.Timeout | undefined;
  private running = false;
  private current: Promise<void> = Promise.resolve();

  constructor(private readonly options: RelayOptions) {}

  start(): void {
    this.running = true;
    this.schedule(0);
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    await this.current;
  }

  private schedule(delay: number): void {
    if (!this.running) return;
    this.timer = setTimeout(() => {
      let handled = 0;
      this.current = this.options
        .tick()
        .then((n) => {
          handled = n;
        })
        .catch((err: unknown) => {
          this.options.logger.error({ err }, 'outbox relay iteration failed');
        })
        .finally(() => this.schedule(handled > 0 ? 0 : this.options.pollIntervalMs));
    }, delay);
  }
}
