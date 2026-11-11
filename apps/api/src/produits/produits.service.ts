import { Inject, Injectable } from '@nestjs/common';
import { produit } from '@agricoop/db';
import { Problems, TenantDb } from '@agricoop/nest-kit';
import { asc, eq } from 'drizzle-orm';

type ProduitRow = typeof produit.$inferSelect;

/** Read side of the catalogue (create/update arrive in phase 4). Always tenant-scoped. */
@Injectable()
export class ProduitsService {
  constructor(@Inject(TenantDb) private readonly tenantDb: TenantDb) {}

  list(): Promise<ProduitRow[]> {
    return this.tenantDb.run((scope) => scope.list(produit, { orderBy: [asc(produit.code)] }));
  }

  async get(produitId: string): Promise<ProduitRow> {
    const row = await this.tenantDb.run((scope) =>
      scope.findOne(produit, eq(produit.produit_id, produitId)),
    );
    // Another cooperative's product is indistinguishable from a missing one: 404, never 403.
    if (!row) throw Problems.notFound('Produit');
    return row;
  }
}
