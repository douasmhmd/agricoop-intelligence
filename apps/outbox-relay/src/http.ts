import { createServer, type Server } from 'node:http';
import type { Registry } from 'prom-client';

export interface ProbeServerOptions {
  registry: Registry;
  /** Readiness: every check must resolve to true. */
  readiness: Record<string, () => Promise<boolean>>;
}

/** Minimal HTTP server for Kubernetes probes and Prometheus: /health/live, /health/ready, /metrics. */
export function createProbeServer({ registry, readiness }: ProbeServerOptions): Server {
  return createServer((req, res) => {
    void (async () => {
      if (req.method !== 'GET') {
        res.writeHead(405).end();
        return;
      }
      switch (req.url) {
        case '/health/live':
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok' }));
          return;
        case '/health/ready': {
          const entries = await Promise.all(
            Object.entries(readiness).map(async ([name, check]) => {
              const up = await check().catch(() => false);
              return [name, { status: up ? 'up' : 'down' }] as const;
            }),
          );
          const ok = entries.every(([, v]) => v.status === 'up');
          res.writeHead(ok ? 200 : 503, { 'content-type': 'application/json' });
          res.end(
            JSON.stringify({ status: ok ? 'ok' : 'error', details: Object.fromEntries(entries) }),
          );
          return;
        }
        case '/metrics':
          res.writeHead(200, { 'content-type': registry.contentType });
          res.end(await registry.metrics());
          return;
        default:
          res.writeHead(404).end();
      }
    })().catch(() => {
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
  });
}
