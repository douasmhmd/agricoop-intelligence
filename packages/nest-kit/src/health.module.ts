import {
  Controller,
  type DynamicModule,
  Get,
  Inject,
  Module,
  type ModuleMetadata,
  type InjectionToken,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
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

  /** Readiness: dependencies (database, ...) are reachable. 503 otherwise. */
  @Get('ready')
  @HealthCheck()
  ready(): Promise<HealthCheckResult> {
    return this.health.check(
      this.checks.map((c) => async () => {
        const indicator = this.indicators.check(c.name);
        return (await c.check()) ? indicator.up() : indicator.down();
      }),
    );
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
