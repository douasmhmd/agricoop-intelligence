import { Controller, type DynamicModule, Get, Global, Inject, Module, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { collectDefaultMetrics, Histogram, Registry } from 'prom-client';

export const METRICS_REGISTRY = Symbol.for('agricoop.METRICS_REGISTRY');

/** Prometheus scrape endpoint. Excluded from the global prefix and from the OpenAPI contract. */
@ApiExcludeController()
@Controller('metrics')
export class MetricsController {
  constructor(@Inject(METRICS_REGISTRY) private readonly registry: Registry) {}

  @Get()
  async scrape(@Res({ passthrough: true }) reply: FastifyReply): Promise<string> {
    void reply.header('content-type', this.registry.contentType);
    return this.registry.metrics();
  }
}

export interface MetricsModuleOptions {
  serviceName: string;
}

@Global()
@Module({})
export class MetricsModule {
  static forRoot(options: MetricsModuleOptions): DynamicModule {
    const registry = new Registry();
    registry.setDefaultLabels({ service: options.serviceName });
    collectDefaultMetrics({ register: registry });
    return {
      module: MetricsModule,
      global: true,
      controllers: [MetricsController],
      providers: [{ provide: METRICS_REGISTRY, useValue: registry }],
      exports: [METRICS_REGISTRY],
    };
  }
}

/**
 * HTTP request duration histogram. Labelled by route TEMPLATE (e.g. `/qr/v1/verify/:token`),
 * never by raw URL, so tokens and IDs never become label values.
 */
export function createHttpHistogram(registry: Registry): Histogram<'method' | 'route' | 'status'> {
  return new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status'] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [registry],
  });
}
