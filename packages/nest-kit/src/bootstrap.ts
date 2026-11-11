import { RequestMethod } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger } from 'nestjs-pino';
import type { Registry } from 'prom-client';
import { createHttpHistogram, METRICS_REGISTRY } from './metrics.module.js';

export interface ConfigureAppOptions {
  /** e.g. "api/v1" or "qr/v1". Health and metrics stay at the root. */
  globalPrefix: string;
  corsOrigins?: readonly string[];
}

/** Applies the cross-cutting setup shared by every NestJS service (also used by tests). */
export function configureApp(app: NestFastifyApplication, options: ConfigureAppOptions): void {
  app.useLogger(app.get(Logger));
  app.setGlobalPrefix(options.globalPrefix, {
    exclude: [
      { path: 'health/live', method: RequestMethod.GET },
      { path: 'health/ready', method: RequestMethod.GET },
      { path: 'metrics', method: RequestMethod.GET },
    ],
  });
  if (options.corsOrigins && options.corsOrigins.length > 0) {
    app.enableCors({ origin: [...options.corsOrigins], credentials: false });
  }
  app.enableShutdownHooks();

  const histogram = createHttpHistogram(app.get<Registry>(METRICS_REGISTRY));
  const fastify = app.getHttpAdapter().getInstance();
  fastify.addHook('onResponse', (request, reply, done) => {
    const route = request.routeOptions.url ?? 'unmatched';
    if (route !== '/metrics') {
      histogram.observe(
        { method: request.method, route, status: String(reply.statusCode) },
        reply.elapsedTime / 1000,
      );
    }
    done();
  });
}
