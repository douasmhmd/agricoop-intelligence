import type { Logger } from 'pino';
import { Counter, Gauge, type Registry } from 'prom-client';

export interface RelayMetrics {
  published: Counter<'type'>;
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

export interface RelayOptions {
  pollIntervalMs: number;
  logger: Logger;
  /** One relay iteration. Phase 5 implements: lock batch (SKIP LOCKED) → publish → mark publie. */
  tick: () => Promise<void>;
}

/** Polling loop with graceful stop. Iterations never overlap. */
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
      this.current = this.options
        .tick()
        .catch((err: unknown) => {
          this.options.logger.error({ err }, 'outbox relay iteration failed');
        })
        .finally(() => this.schedule(this.options.pollIntervalMs));
    }, delay);
  }
}
