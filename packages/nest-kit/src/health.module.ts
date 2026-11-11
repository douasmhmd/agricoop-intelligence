import {
  Controller,
  type DynamicModule,
  Get,
  Inject,
  Module,
  type ModuleMetadata,
  type InjectionToken,
  Res,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { FastifyReply } from 'fastify';
import { Public } from './auth/decorators.js';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorService,
  TerminusModule,
  type HealthCheckResult,
} from '@nestjs/terminus';

export interface ReadinessCheck {
  /** Key in the health response, e.g. "database". */
  name: string;
  check: () => Promise<boolean>;
}

export const READINESS_CHECKS = Symbol.for('agricoop.READINESS_CHECKS');

/** Kubernetes probes. Excluded from the global prefix and from the OpenAPI contract. */
@ApiExcludeController()
@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    @Inject(HealthCheckService) private readonly health: HealthCheckService,
    @Inject(HealthIndicatorService) private readonly indicators: HealthIndicatorService,
    @Inject(READINESS_CHECKS) private readonly checks: ReadinessCheck[],
  ) {}

  /** Liveness: the process is up and the event loop answers. */
  @Get('live')
  @HealthCheck()
  live(): Promise<HealthCheckResult> {
    return this.health.check([]);
  }

  /**
   * Readiness: dependencies (database, ...) are reachable. 503 otherwise, with Terminus' body
   * (returned here directly so the global problem+json filter does not rewrite the probe format).
   */
  @Get('ready')
  async ready(
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<HealthCheckResult | string | object> {
    try {
      return await this.health.check(
        this.checks.map((c) => async () => {
          const indicator = this.indicators.check(c.name);
          return (await c.check()) ? indicator.up() : indicator.down();
        }),
      );
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        void reply.status(503);
        return error.getResponse();
      }
      throw error;
    }
  }
}

export interface HealthModuleOptions {
  imports?: ModuleMetadata['imports'];
  inject?: InjectionToken[];
  // justification: Nest factory providers receive injected values of arbitrary types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- factory arguments come from `inject`
  useFactory: (...args: any[]) => ReadinessCheck[];
}

@Module({})
export class HealthModule {
  static forRootAsync(options: HealthModuleOptions): DynamicModule {
    return {
      module: HealthModule,
      imports: [TerminusModule.forRoot({ logger: false }), ...(options.imports ?? [])],
      controllers: [HealthController],
      providers: [
        {
          provide: READINESS_CHECKS,
          inject: options.inject ?? [],
          useFactory: options.useFactory,
        },
      ],
    };
  }
}
