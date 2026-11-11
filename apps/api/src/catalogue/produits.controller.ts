import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiNoContentResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '@agricoop/nest-kit';
import {
  type Produit,
  produitCreateSchema,
  produitListQuery,
  produitSchema,
  produitUpdateSchema,
} from '@agricoop/shared';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { ProduitsService } from './produits.service';

export class ProduitDto extends createZodDto(produitSchema) {}
export class ProduitCreateDto extends createZodDto(produitCreateSchema) {}
export class ProduitUpdateDto extends createZodDto(produitUpdateSchema) {}
export class ProduitListQueryDto extends createZodDto(produitListQuery) {}

@ApiTags('produits')
@Controller('produits')
@Roles('coop_manager')
export class ProduitsController {
  constructor(@Inject(ProduitsService) private readonly produits: ProduitsService) {}

  /** Products of the cooperative, with their margin. */
  @Get()
  @ZodResponse({ status: 200, description: 'Products of the cooperative', type: [ProduitDto] })
  list(@Query() query: ProduitListQueryDto): Promise<Produit[]> {
    return this.produits.list(query);
  }

  @Get(':produitId')
  @ZodResponse({ status: 200, description: 'The product', type: ProduitDto })
  get(@Param('produitId', new ParseUUIDPipe()) produitId: string): Promise<Produit> {
    return this.produits.get(produitId);
  }

  /** 409 `produit_code_existe` when the code is already used in this cooperative. */
  @Post()
  @ZodResponse({ status: 201, description: 'Product created', type: ProduitDto })
  create(@Body() body: ProduitCreateDto): Promise<Produit> {
    return this.produits.create(body);
  }

  /** 409 `niveau_qr_verrouille` when changing niveau_qr of a product that has lots. */
  @Patch(':produitId')
  @ZodResponse({ status: 200, description: 'Product updated', type: ProduitDto })
  update(
    @Param('produitId', new ParseUUIDPipe()) produitId: string,
    @Body() body: ProduitUpdateDto,
  ): Promise<Produit> {
    return this.produits.update(produitId, body);
  }

  /** 409 `produit_utilise` when lots or order lines reference it (deactivate instead). */
  @Delete(':produitId')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Product deleted' })
  remove(@Param('produitId', new ParseUUIDPipe()) produitId: string): Promise<void> {
    return this.produits.remove(produitId);
  }
}
