import { Controller, Get, Inject, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '@agricoop/nest-kit';
import { type Produit, produitSchema } from '@agricoop/shared';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { ProduitsService } from './produits.service';

export class ProduitDto extends createZodDto(produitSchema) {}

@ApiTags('produits')
@Controller('produits')
@Roles('coop_manager')
export class ProduitsController {
  constructor(@Inject(ProduitsService) private readonly produits: ProduitsService) {}

  /** Products of the caller's cooperative. */
  @Get()
  @ZodResponse({ status: 200, description: 'Products of the cooperative', type: [ProduitDto] })
  async list(): Promise<Produit[]> {
    return (await this.produits.list()) as Produit[];
  }

  /** One product of the caller's cooperative (404 for any other cooperative's product). */
  @Get(':produitId')
  @ZodResponse({ status: 200, description: 'The product', type: ProduitDto })
  async get(@Param('produitId', new ParseUUIDPipe()) produitId: string): Promise<Produit> {
    return (await this.produits.get(produitId)) as Produit;
  }
}
