import {
  Controller,
  type DynamicModule,
  Get,
  Inject,
  Module,
  Param,
  Query,
  RequestMethod,
  Res,
} from '@nestjs/common';
import type { RouteInfo } from '@nestjs/common/interfaces';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { createPool } from '@agricoop/db';
import { Roles } from '@agricoop/nest-kit';
import {
  alerteQrSchema,
  alertesQrQuery,
  anomalieStockSchema,
  clientSegmentSchema,
  kpiMensuelQuery,
  kpiMensuelSchema,
  lotSurveilleSchema,
  previsionAnalyticsQuery,
  previsionAnalyticsSchema,
  risqueInvenduSchema,
  segmentParam,
  segmentSchema,
  stockProduitSchema,
} from '@agricoop/shared';
import type { FastifyReply } from 'fastify';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import type { ApiEnv } from '../env';
import { ANALYTICS_POOL, AnalyticsService } from './analytics.service';

class KpiMensuelDto extends createZodDto(kpiMensuelSchema) {}
class KpiMensuelQueryDto extends createZodDto(kpiMensuelQuery) {}
class StockProduitDto extends createZodDto(stockProduitSchema) {}
class LotSurveilleDto extends createZodDto(lotSurveilleSchema) {}
class RisqueInvenduDto extends createZodDto(risqueInvenduSchema) {}
class PrevisionAnalyticsDto extends createZodDto(previsionAnalyticsSchema) {}
class PrevisionAnalyticsQueryDto extends createZodDto(previsionAnalyticsQuery) {}
class AlerteQrDto extends createZodDto(alerteQrSchema) {}
class AlertesQrQueryDto extends createZodDto(alertesQrQuery) {}
class SegmentDto extends createZodDto(segmentSchema) {}
class SegmentParamDto extends createZodDto(segmentParam) {}
class ClientSegmentDto extends createZodDto(clientSegmentSchema) {}
class AnomalieStockDto extends createZodDto(anomalieStockSchema) {}

/**
 * The paths are fixed by contracts/api/analytics.yaml (`/api/analytics/...`), so this controller
 * lives outside the `api/v1` global prefix: pass ANALYTICS_PREFIX_EXCLUDE to configureApp().
 */
export const ANALYTICS_PATH = 'api/analytics';
export const ANALYTICS_PREFIX_EXCLUDE: RouteInfo[] = [
  { path: `${ANALYTICS_PATH}/{*rest}`, method: RequestMethod.ALL },
];

const DATE_REF = { name: 'X-Date-Reference', description: 'Reference date of the analysis' };

@ApiTags('analytics')
@Controller(ANALYTICS_PATH)
@Roles('coop_manager')
export class AnalyticsController {
  constructor(@Inject(AnalyticsService) private readonly analytics: AnalyticsService) {}

  private async withDateReference(reply: FastifyReply): Promise<void> {
    const date = await this.analytics.dateReference();
    if (date) void reply.header('X-Date-Reference', date);
  }

  /** Monthly indicators (revenue, margin, orders, average basket, customers). */
  @Get('kpi-mensuels')
  @ZodResponse({ status: 200, description: 'One item per month', type: [KpiMensuelDto] })
  kpiMensuels(@Query() query: KpiMensuelQueryDto) {
    return this.analytics.kpiMensuels(query.campagne);
  }

  /** Available stock and coverage per product, with an alert level. */
  @Get('stocks')
  @ApiHeader(DATE_REF)
  @ZodResponse({ status: 200, description: 'One item per product', type: [StockProduitDto] })
  async stocks(@Res({ passthrough: true }) reply: FastifyReply) {
    await this.withDateReference(reply);
    return this.analytics.stocks();
  }

  /** Lots still in stock that expire within 60 days. */
  @Get('lots-a-surveiller')
  @ApiHeader(DATE_REF)
  @ZodResponse({ status: 200, description: 'By expiry date', type: [LotSurveilleDto] })
  async lotsASurveiller(@Res({ passthrough: true }) reply: FastifyReply) {
    await this.withDateReference(reply);
    return this.analytics.lotsASurveiller();
  }

  /** Lots likely to expire before being sold (an estimate from the last 28 days of sales). */
  @Get('risque-invendus')
  @ApiHeader(DATE_REF)
  @ZodResponse({ status: 200, description: 'By value at risk', type: [RisqueInvenduDto] })
  async risqueInvendus(@Res({ passthrough: true }) reply: FastifyReply) {
    await this.withDateReference(reply);
    return this.analytics.risqueInvendus();
  }

  /** Demand forecasts against actual sales, per famille and week. */
  @Get('previsions')
  @ZodResponse({ status: 200, description: 'Per famille and week', type: [PrevisionAnalyticsDto] })
  previsions(@Query() query: PrevisionAnalyticsQueryDto) {
    return this.analytics.previsions(query.famille);
  }

  /** Suspect QR codes (likely copies) from the latest analysis. */
  @Get('alertes-qr')
  @ZodResponse({ status: 200, description: 'Latest alerts', type: [AlerteQrDto] })
  alertesQr(@Query() query: AlertesQrQueryDto) {
    return this.analytics.alertesQr(query.niveau);
  }

  /** Customers per segment (latest segmentation). */
  @Get('segments')
  @ZodResponse({ status: 200, description: 'One item per segment', type: [SegmentDto] })
  segments() {
    return this.analytics.segments();
  }

  /** Technical ids of a segment's customers (contact details stay in the operational plane). */
  @Get('segments/:segment/clients')
  @ZodResponse({ status: 200, description: 'By amount', type: [ClientSegmentDto] })
  clientsDuSegment(@Param() params: SegmentParamDto) {
    return this.analytics.clientsDuSegment(params.segment);
  }

  /** Stock anomalies to correct (an empty list is the expected result). */
  @Get('anomalies-stock')
  @ZodResponse({ status: 200, description: 'Lots in anomaly', type: [AnomalieStockDto] })
  anomaliesStock() {
    return this.analytics.anomaliesStock();
  }
}

@Module({})
export class AnalyticsModule {
  static register(env: Pick<ApiEnv, 'ANALYTICS_DATABASE_URL'>): DynamicModule {
    return {
      module: AnalyticsModule,
      controllers: [AnalyticsController],
      providers: [
        {
          provide: ANALYTICS_POOL,
          useValue: env.ANALYTICS_DATABASE_URL
            ? createPool({
                connectionString: env.ANALYTICS_DATABASE_URL,
                applicationName: 'agricoop-api-analytics',
                max: 4,
              })
            : null,
        },
        AnalyticsService,
      ],
    };
  }
}
