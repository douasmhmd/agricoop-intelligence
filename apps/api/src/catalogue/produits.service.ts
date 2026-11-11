import { Inject, Injectable } from '@nestjs/common';
import { ligne_commande, lot, produit, type TenantScope } from '@agricoop/db';
import { isUniqueViolation, Problems, TenantDb } from '@agricoop/nest-kit';
import {
  margin,
  type Produit,
  type ProduitCreate,
  type ProduitListQuery,
  type ProduitUpdate,
} from '@agricoop/shared';
import { and, asc, eq } from 'drizzle-orm';

type ProduitRow = typeof produit.$inferSelect;

export function toProduit(row: ProduitRow): Produit {
  const { mad, pct } = margin(row.prix_mad, row.cout_mad);
  return {
    produit_id: row.produit_id,
    code: row.code,
    nom: row.nom,
    famille: row.famille as Produit['famille'],
    categorie: row.categorie,
    prix_mad: row.prix_mad,
    cout_mad: row.cout_mad,
    marge_mad: mad,
    marge_pct: pct,
    conservation_j: row.conservation_j,
    huile_ml_par_unite: row.huile_ml_par_unite,
    niveau_qr: row.niveau_qr as Produit['niveau_qr'],
    actif: row.actif,
    is_synthetic: row.is_synthetic,
  };
}

const codeTaken = () =>
  Problems.conflict('produit_code_existe', 'A product with this code already exists');

@Injectable()
export class ProduitsService {
  constructor(@Inject(TenantDb) private readonly tenantDb: TenantDb) {}

  async list(query: ProduitListQuery): Promise<Produit[]> {
    const rows = await this.tenantDb.run((scope) =>
      scope.list(produit, {
        where: and(
          query.famille ? eq(produit.famille, query.famille) : undefined,
          query.actif ? eq(produit.actif, query.actif === 'true') : undefined,
          query.synthetic === 'exclude' ? eq(produit.is_synthetic, false) : undefined,
        ),
        orderBy: [asc(produit.code)],
      }),
    );
    return rows.map(toProduit);
  }

  async get(produitId: string): Promise<Produit> {
    return toProduit(await this.tenantDb.run((scope) => this.find(scope, produitId)));
  }

  async create(input: ProduitCreate): Promise<Produit> {
    try {
      const row = await this.tenantDb.run((scope) => scope.insert(produit, input));
      return toProduit(row);
    } catch (error) {
      if (isUniqueViolation(error, 'produit_coop_id_code_key')) throw codeTaken();
      throw error;
    }
  }

  async update(produitId: string, patch: ProduitUpdate): Promise<Produit> {
    try {
      const row = await this.tenantDb.run(async (scope) => {
        const existing = await this.find(scope, produitId);
        if (patch.niveau_qr && patch.niveau_qr !== existing.niveau_qr) {
          if (await scope.findOne(lot, eq(lot.produit_id, produitId))) {
            throw Problems.conflict(
              'niveau_qr_verrouille',
              'niveau_qr cannot change once the product has lots (QR codes depend on it)',
            );
          }
        }
        const [updated] = await scope.update(produit, patch, eq(produit.produit_id, produitId));
        return updated ?? existing;
      });
      return toProduit(row);
    } catch (error) {
      if (isUniqueViolation(error, 'produit_coop_id_code_key')) throw codeTaken();
      throw error;
    }
  }

  /** Hard delete only for unused products; otherwise set `actif: false`. */
  async remove(produitId: string): Promise<void> {
    await this.tenantDb.run(async (scope) => {
      await this.find(scope, produitId);
      const used =
        (await scope.findOne(lot, eq(lot.produit_id, produitId))) ??
        (await scope.findOne(ligne_commande, eq(ligne_commande.produit_id, produitId)));
      if (used) {
        throw Problems.conflict(
          'produit_utilise',
          'The product has lots or order lines; deactivate it instead (actif: false)',
        );
      }
      await scope.delete(produit, eq(produit.produit_id, produitId));
    });
  }

  private async find(scope: TenantScope, produitId: string): Promise<ProduitRow> {
    const row = await scope.findOne(produit, eq(produit.produit_id, produitId));
    if (!row) throw Problems.notFound('Produit');
    return row;
  }
}
