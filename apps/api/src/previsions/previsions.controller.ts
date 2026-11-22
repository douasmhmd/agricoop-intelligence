import { Controller, Get, Inject, Module, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '@agricoop/nest-kit';
import {
  type Previsions,
  previsionsQuery,
  previsionsSchema,
  type VersionModele,
  versionModeleSchema,
  type PrevisionProduit,
  previsionProduitSchema,
  previsionsProduitsQuery,
} from '@agricoop/shared';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { PrevisionsService } from './previsions.service';

export class PrevisionsDto extends createZodDto(previsionsSchema) {}
export class PrevisionsQueryDto extends createZodDto(previsionsQuery) {}
export class VersionModeleDto extends createZodDto(versionModeleSchema) {}
export class PrevisionProduitDto extends createZodDto(previsionProduitSchema) {}
export class PrevisionsProduitsQueryDto extends createZodDto(previsionsProduitsQuery) {}

@ApiTags('previsions')
@Controller('previsions')
@Roles('coop_manager')
export class PrevisionsController {
  constructor(@Inject(PrevisionsService) private readonly previsions: PrevisionsService) {}

  /** Forecast model versions written back by the analytics plane, newest first. */
  @Get('versions')
  @ZodResponse({ status: 200, description: 'Model versions', type: [VersionModeleDto] })
  versions(): Promise<VersionModele[]> {
    return this.previsions.versions();
  }

  /** Weekly forecasts per famille next to actual weekly sales. */
  @Get()
  @ZodResponse({ status: 200, description: 'Forecast and sales series', type: PrevisionsDto })
  series(@Query() query: PrevisionsQueryDto): Promise<Previsions> {
    return this.previsions.series(query);
  }

  /** Prévisions IA hebdomadaires par produit. */
  @Get('produits')
  @ZodResponse({
    status: 200,
    description: 'Prévisions IA par produit',
    type: [PrevisionProduitDto],
  })
  produits(@Query() query: PrevisionsProduitsQueryDto): Promise<PrevisionProduit[]> {
    return this.previsions.produits(query);
  }
}

@Module({ controllers: [PrevisionsController], providers: [PrevisionsService] })
export class PrevisionsModule {}
