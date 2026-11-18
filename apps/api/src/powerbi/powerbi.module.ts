import { Controller, type DynamicModule, Get, Inject, Module, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminTenantOptional, RateLimit, Roles } from '@agricoop/nest-kit';
import { powerBiEmbedSchema, powerBiReportKeyParam, powerBiReportsSchema } from '@agricoop/shared';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import type { ApiEnv } from '../env';
import { missingPowerBiSettings, powerBiConfig } from './config';
import { EntraTokenProvider } from './entra-token';
import { POWERBI_API, type PowerBiApi, RestPowerBiApi } from './powerbi.client';
import { POWERBI_CONFIG, POWERBI_MISSING, PowerBiService } from './powerbi.service';

class PowerBiReportsDto extends createZodDto(powerBiReportsSchema) {}
class PowerBiEmbedDto extends createZodDto(powerBiEmbedSchema) {}
class PowerBiReportKeyParamDto extends createZodDto(powerBiReportKeyParam) {}

/**
 * Power BI Embedded, "embed for your customers": the API is the only holder of the service
 * principal; the browser gets short-lived embed tokens filtered by row-level security.
 * Under /api/v1 (not the data plane's /api/analytics contract).
 */
@ApiTags('powerbi')
@Controller('analytics/powerbi')
@Roles('coop_manager')
@AdminTenantOptional()
export class PowerBiController {
  constructor(@Inject(PowerBiService) private readonly powerbi: PowerBiService) {}

  /** Reports this user can open (demo mode when Power BI is not configured). */
  @Get('reports')
  @ZodResponse({
    status: 200,
    description: 'Available reports, or demo mode',
    type: PowerBiReportsDto,
  })
  reports() {
    return this.powerbi.reports();
  }

  /** Embed token for one report, filtered on the caller's cooperative (row-level security). */
  @Get('embed/:reportKey')
  @RateLimit(30)
  @ZodResponse({
    status: 200,
    description: 'Embed configuration, or demo mode',
    type: PowerBiEmbedDto,
  })
  embed(@Param() params: PowerBiReportKeyParamDto) {
    return this.powerbi.embed(params.reportKey);
  }
}

@Module({})
export class PowerBiModule {
  static register(env: ApiEnv): DynamicModule {
    const config = powerBiConfig(env);
    return {
      module: PowerBiModule,
      controllers: [PowerBiController],
      providers: [
        PowerBiService,
        { provide: POWERBI_CONFIG, useValue: config },
        { provide: POWERBI_MISSING, useValue: missingPowerBiSettings(env) },
        {
          provide: POWERBI_API,
          useFactory: (): PowerBiApi | undefined =>
            config ? new RestPowerBiApi(config.apiUrl, new EntraTokenProvider(config)) : undefined,
        },
      ],
    };
  }
}
