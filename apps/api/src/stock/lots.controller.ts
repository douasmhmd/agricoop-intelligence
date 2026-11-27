import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '@agricoop/nest-kit';
import {
  type AlertePeremption,
  alertePeremptionSchema,
  alertesQuery,
  type Lot,
  lotCreateSchema,
  lotListQuery,
  type LotPage,
  lotPageSchema,
  lotSchema,
  type Mouvement,
  mouvementSchema,
  perteCreateSchema,
  type PerteResult,
  perteResultSchema,
} from '@agricoop/shared';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { LotsService } from './lots.service';

export class LotDto extends createZodDto(lotSchema) {}
export class LotPageDto extends createZodDto(lotPageSchema) {}
export class LotCreateDto extends createZodDto(lotCreateSchema) {}
export class LotListQueryDto extends createZodDto(lotListQuery) {}
export class MouvementDto extends createZodDto(mouvementSchema) {}
export class PerteCreateDto extends createZodDto(perteCreateSchema) {}
export class PerteResultDto extends createZodDto(perteResultSchema) {}
export class AlertePeremptionDto extends createZodDto(alertePeremptionSchema) {}
export class AlertesQueryDto extends createZodDto(alertesQuery) {}

@ApiTags('lots')
@Controller('lots')
@Roles('coop_manager')
export class LotsController {
  constructor(@Inject(LotsService) private readonly lots: LotsService) {}

  /** Lots with their computed stock and status, paginated. */
  @Get()
  @ZodResponse({ status: 200, description: 'A page of lots', type: LotPageDto })
  list(@Query() query: LotListQueryDto): Promise<LotPage> {
    return this.lots.list(query);
  }

  @Get(':lotId')
  @ZodResponse({ status: 200, description: 'The lot with its stock', type: LotDto })
  get(@Param('lotId', new ParseUUIDPipe()) lotId: string): Promise<Lot> {
    return this.lots.get(lotId);
  }

  /**
   * Creates a lot, its initial stock entry and (unit-level QR products) its serial units.
   * 409 `lot_numero_existe` / `produit_inactif`; 404 when the product is not in this cooperative.
   */
  @Post()
  @ZodResponse({ status: 201, description: 'Lot created', type: LotDto })
  create(@Body() body: LotCreateDto): Promise<Lot> {
    return this.lots.create(body);
  }

  @Get(':lotId/mouvements')
  @ZodResponse({ status: 200, description: 'Stock movements of the lot', type: [MouvementDto] })
  mouvements(@Param('lotId', new ParseUUIDPipe()) lotId: string): Promise<Mouvement[]> {
    return this.lots.mouvements(lotId);
  }

  /** Records a loss (perte). 409 `stock_insuffisant` when it exceeds the current stock. */
  @Post(':lotId/pertes')
  @ZodResponse({ status: 201, description: 'Loss recorded', type: PerteResultDto })
  perte(
    @Param('lotId', new ParseUUIDPipe()) lotId: string,
    @Body() body: PerteCreateDto,
  ): Promise<PerteResult> {
    return this.lots.perte(lotId, body);
  }
}

@ApiTags('stock')
@Controller('stock')
@Roles('coop_manager')
export class StockController {
  constructor(@Inject(LotsService) private readonly lots: LotsService) {}

  /** Lots with stock that are expired or expire within 30 / 60 / 90 days. */
  @Get('alertes-peremption')
  @ZodResponse({
    status: 200,
    description: 'Expiry alerts, most urgent first',
    type: [AlertePeremptionDto],
  })
  alertes(@Query() query: AlertesQueryDto): Promise<AlertePeremption[]> {
    return this.lots.alertes(query);
  }
}
