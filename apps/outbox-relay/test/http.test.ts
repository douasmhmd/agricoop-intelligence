import type { AddressInfo } from 'node:net';
import { Registry } from 'prom-client';
import { afterEach, describe, expect, it } from 'vitest';
import { createProbeServer } from '../src/http';
import { createRelayMetrics } from '../src/relay';

describe('outbox-relay probe server', () => {
  let close: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await close?.();
  });

  async function start(dbUp: boolean): Promise<string> {
    const registry = new Registry();
    createRelayMetrics(registry);
    const server = createProbeServer({
      registry,
      readiness: {
        database: () => (dbUp ? Promise.resolve(true) : Promise.reject(new Error('down'))),
      },
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    close = () => new Promise<void>((resolve) => server.close(() => resolve()));
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }

  it('serves liveness', async () => {
    const base = await start(true);
    const res = await fetch(`${base}/health/live`);
    expect(res.status).toBe(200);
  });

  it('reports readiness from the database check', async () => {
    expect((await fetch(`${await start(true)}/health/ready`)).status).toBe(200);
    await close?.();
    const res = await fetch(`${await start(false)}/health/ready`);
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ details: { database: { status: 'down' } } });
  });

  it('exposes relay metrics', async () => {
    const body = await (await fetch(`${await start(true)}/metrics`)).text();
    expect(body).toContain('outbox_events_published_total');
    expect(body).toContain('outbox_lag_seconds');
  });
});
