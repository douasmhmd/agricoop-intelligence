import { Inject, Injectable } from '@nestjs/common';
import {
  lockLotForStock,
  lot,
  type LotWithStock,
  lotsWithStock,
  mouvement_stock,
  produit,
  signedStock,
  type TenantScope,
} from '@agricoop/db';
import {
  appendEvent,
  CLOCK,
  type Clock,
  isUniqueViolation,
  Problems,
  TenantDb,
  today,
} from '@agricoop/nest-kit';
import {
  addDays,
  type AlertePeremption,
  type AlertesQuery,
  daysBetween,
  defaultDatePeremption,
  isExpired,
  type Lot,
  type LotCreate,
  type LotListQuery,
  type LotPage,
  type LotStatut,
  type Mouvement,
  type PerteCreate,
  type PerteResult,
  toIsoTimestamp,
} from '@agricoop/shared';
import { and, asc, eq, gt, lte, type SQL, sql } from 'drizzle-orm';

type MouvementRow = typeof mouvement_stock.$inferSelect;

export function lotStatut(
  row: Pick<LotWithStock, 'stock' | 'date_peremption'>,
  day: string,
): LotStatut {
  if (row.stock <= 0) return 'epuise';
  return isExpired(row.date_peremption, day) ? 'perime' : 'disponible';
}

export function toLot(row: LotWithStock, day: string): Lot {
  return {
    lot_id: row.lot_id,
    produit_id: row.produit_id,
    produit_code: row.produit_code,
    produit_nom: row.produit_nom,
    niveau_qr: row.niveau_qr as Lot['niveau_qr'],
    numero: row.numero,
    date_fabrication: row.date_fabrication,
    date_peremption: row.date_peremption,
    quantite_initiale: row.quantite_initiale,
    stock: row.stock,
    statut: lotStatut(row, day),
    is_synthetic: row.is_synthetic,
  };
}

export function toMouvement(row: MouvementRow): Mouvement {
  return {
    mouvement_id: row.mouvement_id,
    lot_id: row.lot_id,
    type_mouvement: row.type_mouvement as Mouvement['type_mouvement'],
    quantite: row.quantite,
    date_mouvement: toIsoTimestamp(row.date_mouvement),
    is_synthetic: row.is_synthetic,
  };
}

function syntheticWhere(mode: 'include' | 'exclude'): SQL | undefined {
  return mode === 'exclude' ? eq(lot.is_synthetic, false) : undefined;
}

/**
 * Production lots and their stock. Stock is never stored: it is the signed sum of mouvement_stock.
 * Every stock change locks the lot row first (lockLotForStock) so concurrent changes are serialized.
 */
@Injectable()
export class LotsService {
  constructor(
    @Inject(TenantDb) private readonly tenantDb: TenantDb,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async list(query: LotListQuery): Promise<LotPage> {
    const day = today(this.clock);
    const { rows, total } = await this.tenantDb.run((scope) =>
      lotsWithStock(scope, {
        where: and(
          query.produit_id ? eq(lot.produit_id, query.produit_id) : undefined,
          syntheticWhere(query.synthetic),
          query.statut === 'perime' ? lte(lot.date_peremption, day) : undefined,
          query.statut === 'disponible' ? gt(lot.date_peremption, day) : undefined,
        ),
        having:
          query.statut === 'epuise'
            ? sql`${signedStock} <= 0`
            : query.statut
              ? sql`${signedStock} > 0`
              : undefined,
        limit: query.pageSize,
        offset: (query.page - 1) * query.pageSize,
      }),
    );
    return {
      items: rows.map((r) => toLot(r, day)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async get(lotId: string): Promise<Lot> {
    const day = today(this.clock);
    const row = await this.tenantDb.run((scope) => this.findWithStock(scope, lotId));
    return toLot(row, day);
  }

  /**
   * Creates a lot in one transaction: lot row, initial `entree` movement, `unite` rows 1..N when the
   * product is tracked per unit, and the outbox events lot_cree + stock_modifie.
   */
  async create(input: LotCreate): Promise<Lot> {
    const day = today(this.clock);
    const now = this.clock.now().toISOString();
    try {
      return await this.tenantDb.run(async (scope) => {
        const p = await scope.findOne(produit, eq(produit.produit_id, input.produit_id));
        if (!p) throw Problems.notFound('Produit');
        if (!p.actif) {
          throw Problems.conflict(
            'produit_inactif',
            'Lots cannot be created for an inactive product',
          );
        }
        const datePeremption =
          input.date_peremption ?? defaultDatePeremption(input.date_fabrication, p.conservation_j);

        const created = await scope.insert(lot, {
          produit_id: p.produit_id,
          numero: input.numero,
          date_fabrication: input.date_fabrication,
          date_peremption: datePeremption,
          quantite_initiale: input.quantite_initiale,
        });
        const entree = await scope.insert(mouvement_stock, {
          lot_id: created.lot_id,
          type_mouvement: 'entree',
          quantite: input.quantite_initiale,
          date_mouvement: now,
        });
        if (p.niveau_qr === 'unite') {
          await scope.tx.execute(sql`
            INSERT INTO unite (coop_id, lot_id, numero_serie)
            SELECT ${scope.coopId}, ${created.lot_id}, g
            FROM generate_series(1, ${input.quantite_initiale}::int) AS g`);
        }

        // Shared contract: a new lot is published as its production `entree` (no lot event).
        await appendEvent(scope, 'stock_modifie', {
          mouvement_id: entree.mouvement_id,
          lot_id: created.lot_id,
          produit_id: p.produit_id,
          code_produit: p.code,
          type_mouvement: 'entree',
          quantite: entree.quantite,
          date_mouvement: toIsoTimestamp(entree.date_mouvement),
        });

        return toLot(
          {
            ...created,
            produit_code: p.code,
            produit_nom: p.nom,
            niveau_qr: p.niveau_qr,
            stock: input.quantite_initiale,
          },
          day,
        );
      });
    } catch (error) {
      if (isUniqueViolation(error, 'lot_coop_id_numero_key')) {
        throw Problems.conflict('lot_numero_existe', 'A lot with this number already exists');
      }
      throw error;
    }
  }

  async mouvements(lotId: string): Promise<Mouvement[]> {
    const rows = await this.tenantDb.run(async (scope) => {
      await this.findWithStock(scope, lotId);
      return scope.list(mouvement_stock, {
        where: eq(mouvement_stock.lot_id, lotId),
        orderBy: [asc(mouvement_stock.date_mouvement), asc(mouvement_stock.mouvement_id)],
      });
    });
    return rows.map(toMouvement);
  }

  /** Records a loss. The lot is locked, so concurrent losses / orders can never drive stock below 0. */
  async perte(lotId: string, input: PerteCreate): Promise<PerteResult> {
    const now = this.clock.now().toISOString();
    return this.tenantDb.run(async (scope) => {
      const locked = await lockLotForStock(scope, lotId);
      if (!locked) throw Problems.notFound('Lot');
      if (input.quantite > locked.stock) {
        throw Problems.conflict(
          'stock_insuffisant',
          `Only ${locked.stock} unit(s) left in this lot`,
        );
      }
      const row = await scope.insert(mouvement_stock, {
        lot_id: lotId,
        type_mouvement: 'perte',
        quantite: input.quantite,
        date_mouvement: now,
      });
      const stockApres = locked.stock - input.quantite;
      const [prod] = await scope.list(produit, {
        where: eq(produit.produit_id, locked.lot.produit_id),
      });
      await appendEvent(scope, 'stock_modifie', {
        mouvement_id: row.mouvement_id,
        lot_id: lotId,
        produit_id: locked.lot.produit_id,
        code_produit: prod?.code ?? '',
        type_mouvement: 'perte',
        quantite: row.quantite,
        date_mouvement: toIsoTimestamp(row.date_mouvement),
      });
      return { mouvement: toMouvement(row), stock_apres: stockApres };
    });
  }

  /**
   * Lots with stock expiring within the horizon (30/60/90 days), plus already-expired lots with
   * stock, bucketed by urgency.
   */
  async alertes(query: AlertesQuery): Promise<AlertePeremption[]> {
    const day = today(this.clock);
    const { rows } = await this.tenantDb.run((scope) =>
      lotsWithStock(scope, {
        where: and(
          lte(lot.date_peremption, addDays(day, query.jours)),
          syntheticWhere(query.synthetic),
        ),
        having: sql`${signedStock} > 0`,
      }),
    );
    return rows.map((row) => {
      const joursRestants = daysBetween(day, row.date_peremption);
      const niveau =
        joursRestants <= 0
          ? 'perime'
          : joursRestants <= 30
            ? 'j30'
            : joursRestants <= 60
              ? 'j60'
              : 'j90';
      return { ...toLot(row, day), jours_restants: joursRestants, niveau };
    });
  }

  private async findWithStock(scope: TenantScope, lotId: string): Promise<LotWithStock> {
    const { rows } = await lotsWithStock(scope, { where: eq(lot.lot_id, lotId) });
    const row = rows[0];
    if (!row) throw Problems.notFound('Lot');
    return row;
  }
}
