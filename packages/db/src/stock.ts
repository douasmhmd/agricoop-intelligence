import { and, asc, eq, getTableColumns, gt, inArray, type SQL, sql } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { lot, mouvement_stock, produit } from './generated/schema.js';
import type { TenantScope } from './tenant.js';

/*
 * Stock of a lot = Σ entree − Σ sortie − Σ perte, always computed from mouvement_stock (never stored).
 *
 * Concurrency rule: every operation that changes the stock of a lot (loss, order, cancellation) first
 * calls lockLotForStock(), which takes a row lock on the lot (SELECT … FOR UPDATE). Concurrent
 * writers on the same lot are serialized, so a stock check followed by a movement is atomic.
 */

/** Signed sum of movements; use with mouvement_stock joined / filtered to the wanted lot(s). */
export const signedStock = sql<number>`coalesce(sum(case when ${mouvement_stock.type_mouvement} = 'entree' then ${mouvement_stock.quantite} else -${mouvement_stock.quantite} end), 0)::int`;

export type LotRow = typeof lot.$inferSelect;
export interface LotWithStock extends LotRow {
  produit_code: string;
  produit_nom: string;
  niveau_qr: string;
  stock: number;
}

export interface LotsWithStockOptions {
  /** Conditions on lot / produit columns. */
  where?: SQL;
  /** Conditions on the aggregated stock, e.g. sql`${signedStock} > 0`. */
  having?: SQL;
  orderBy?: (PgColumn | SQL)[];
  limit?: number;
  offset?: number;
}

/** Lots of the current tenant with their product and computed stock; `total` ignores limit/offset. */
export async function lotsWithStock(
  scope: TenantScope,
  options: LotsWithStockOptions = {},
): Promise<{ rows: LotWithStock[]; total: number }> {
  let query = scope.tx
    .select({
      ...getTableColumns(lot),
      produit_code: produit.code,
      produit_nom: produit.nom,
      niveau_qr: produit.niveau_qr,
      stock: signedStock,
      total: sql<number>`(count(*) over ())::int`,
    })
    .from(lot)
    .innerJoin(produit, and(eq(produit.produit_id, lot.produit_id), scope.owns(produit)))
    .leftJoin(
      mouvement_stock,
      and(eq(mouvement_stock.lot_id, lot.lot_id), scope.owns(mouvement_stock)),
    )
    .where(options.where ? and(scope.owns(lot), options.where) : scope.owns(lot))
    .groupBy(lot.lot_id, produit.produit_id)
    .$dynamic();
  if (options.having) query = query.having(options.having);
  query = query.orderBy(...(options.orderBy ?? [asc(lot.date_peremption), asc(lot.numero)]));
  if (options.limit !== undefined) query = query.limit(options.limit);
  if (options.offset !== undefined) query = query.offset(options.offset);

  const rows = await query;
  const total = rows[0]?.total ?? 0;
  return { rows: rows.map(({ total: _t, ...row }) => row), total };
}

/** Current stock of one lot of the current tenant. */
export async function lotStock(scope: TenantScope, lotId: string): Promise<number> {
  const [row] = await scope.tx
    .select({ stock: signedStock })
    .from(mouvement_stock)
    .where(and(scope.owns(mouvement_stock), eq(mouvement_stock.lot_id, lotId)));
  return row?.stock ?? 0;
}

/**
 * Locks the lot row until the end of the transaction and returns it with its stock, or undefined
 * when the lot does not exist in this tenant.
 */
export async function lockLotForStock(
  scope: TenantScope,
  lotId: string,
): Promise<{ lot: LotRow; stock: number } | undefined> {
  const [locked] = await scope.list(lot, { where: eq(lot.lot_id, lotId), forUpdate: true });
  if (!locked) return undefined;
  return { lot: locked, stock: await lotStock(scope, lotId) };
}

export interface AllocatableLot {
  lot_id: string;
  produit_id: string;
  numero: string;
  date_peremption: string;
  stock: number;
}

/**
 * Locks every non-expired lot of the given products (FOR UPDATE), in ONE global order —
 * date_peremption, then lot_id — so that concurrent orders touching overlapping lots always lock
 * in the same order and cannot deadlock. Returns them FEFO-sorted with their stock.
 *
 * `today` is the business date: lots with date_peremption <= today are expired and skipped.
 */
export async function lockLotsForAllocation(
  scope: TenantScope,
  produitIds: readonly string[],
  today: string,
): Promise<AllocatableLot[]> {
  if (produitIds.length === 0) return [];
  const locked = await scope.list(lot, {
    where: and(inArray(lot.produit_id, [...produitIds]), gt(lot.date_peremption, today)),
    orderBy: [asc(lot.date_peremption), asc(lot.lot_id)],
    forUpdate: true,
  });
  if (locked.length === 0) return [];
  const stocks = await scope.tx
    .select({ lot_id: mouvement_stock.lot_id, stock: signedStock })
    .from(mouvement_stock)
    .where(
      and(
        scope.owns(mouvement_stock),
        inArray(
          mouvement_stock.lot_id,
          locked.map((l) => l.lot_id),
        ),
      ),
    )
    .groupBy(mouvement_stock.lot_id);
  const byLot = new Map(stocks.map((s) => [s.lot_id, s.stock]));
  return locked.map((l) => ({
    lot_id: l.lot_id,
    produit_id: l.produit_id,
    numero: l.numero,
    date_peremption: l.date_peremption,
    stock: byLot.get(l.lot_id) ?? 0,
  }));
}

/** Orderable units per product: stock of non-expired lots (no locking; display only). */
export async function availableStockByProduit(
  scope: TenantScope,
  today: string,
): Promise<Map<string, number>> {
  const rows = await scope.tx
    .select({ produit_id: lot.produit_id, stock: signedStock })
    .from(lot)
    .innerJoin(
      mouvement_stock,
      and(eq(mouvement_stock.lot_id, lot.lot_id), scope.owns(mouvement_stock)),
    )
    .where(and(scope.owns(lot), gt(lot.date_peremption, today)))
    .groupBy(lot.produit_id);
  return new Map(rows.map((r) => [r.produit_id, Math.max(0, r.stock)]));
}
