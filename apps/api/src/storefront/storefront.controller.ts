import { Controller, Get, Inject, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { availableStockByProduit, type Database, listCooperatives, produit } from '@agricoop/db';
import { CLOCK, type Clock, DB, Public, TenantDb, today } from '@agricoop/nest-kit';
import {
  type CooperativePublique,
  cooperativePubliqueSchema,
  type ProduitCatalogue,
  produitCatalogueSchema,
} from '@agricoop/shared';
import { asc, eq } from 'drizzle-orm';
import { createZodDto, ZodResponse } from 'nestjs-zod';

export class CooperativePubliqueDto extends createZodDto(cooperativePubliqueSchema) {}
export class ProduitCatalogueDto extends createZodDto(produitCatalogueSchema) {}

/** Public storefront reads. The tenant is the cooperative code in the URL. */
@ApiTags('storefront')
@Controller('coops')
@Public()
export class StorefrontController {
  constructor(
    @Inject(TenantDb) private readonly tenantDb: TenantDb,
    @Inject(DB) private readonly db: Database,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  @Get()
  @ZodResponse({
    status: 200,
    description: 'Cooperatives on the platform',
    type: [CooperativePubliqueDto],
  })
  async list(): Promise<CooperativePublique[]> {
    return (await listCooperatives(this.db)).map(({ code, nom, province }) => ({
      code,
      nom,
      province,
    }));
  }

  @Get(':code')
  @ZodResponse({ status: 200, description: 'The cooperative', type: CooperativePubliqueDto })
  async get(@Param('code') code: string): Promise<CooperativePublique> {
    const { nom, province } = await this.tenantDb.cooperative(code);
    return { code, nom, province };
  }

  /** Active products with the quantity that can be ordered now (non-expired stock). */
  @Get(':code/produits')
  @ZodResponse({ status: 200, description: 'Storefront catalogue', type: [ProduitCatalogueDto] })
  catalogue(@Param('code') code: string): Promise<ProduitCatalogue[]> {
    const day = today(this.clock);
    return this.tenantDb.runForCode(code, async (scope) => {
      const [rows, stock] = await Promise.all([
        scope.list(produit, {
          where: eq(produit.actif, true),
          orderBy: [asc(produit.famille), asc(produit.code)],
        }),
        availableStockByProduit(scope, day),
      ]);
      return rows.map((p) => ({
        produit_id: p.produit_id,
        code: p.code,
        nom: p.nom,
        famille: p.famille as ProduitCatalogue['famille'],
        categorie: p.categorie,
        prix_mad: p.prix_mad,
        niveau_qr: p.niveau_qr as ProduitCatalogue['niveau_qr'],
        disponible: stock.get(p.produit_id) ?? 0,
      }));
    });
  }
}
