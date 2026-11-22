import { and, eq, sql, type SQL } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import type { Schema } from './client.js';
import * as t from './generated/schema.js';
import { previsionProduit } from './prevision-produit.js';

/*
 * Tenant isolation, enforced centrally.
 *
 * withTenant(db, coopId, fn) opens a transaction, sets the Postgres setting `app.coop_id` for that
 * transaction only (set_config(..., true)) — which the row-level-security policies of proposal 001
 * read — and hands `fn` a TenantScope whose helpers add `coop_id = :coopId` to every select, update
 * and delete, and force `coop_id` on every insert. Business code never passes coop_id itself.
 *
 * Works with and without RLS: without it, the scope's predicates isolate tenants; with it, a query
 * that forgot the predicate through the raw `tx` escape hatch still cannot see other tenants' rows.
 */

/** Business tables that carry coop_id. (`cooperative` is the tenant itself; `client_pii` is reached via `client`.) */
export const tenantTables = {
  produit: t.produit,
  lot: t.lot,
  unite: t.unite,
  qr_code: t.qr_code,
  scan_qr: t.scan_qr,
  client: t.client,
  commande: t.commande,
  ligne_commande: t.ligne_commande,
  mouvement_stock: t.mouvement_stock,
  prevision: t.prevision,
  prevision_produit: previsionProduit,
  outbox: t.outbox,
} as const;

export type TenantTable = (typeof tenantTables)[keyof typeof tenantTables];
/** The transaction object drizzle passes to `db.transaction(cb)`. */
export type Tx = Parameters<Parameters<NodePgDatabase<Schema>['transaction']>[0]>[0];

type Row<T extends TenantTable> = T['$inferSelect'];
type NewRow<T extends TenantTable> = Omit<T['$inferInsert'], 'coop_id'>;
type Patch<T extends TenantTable> = Partial<Omit<T['$inferInsert'], 'coop_id'>>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class InvalidTenantError extends Error {
  constructor() {
    super('Invalid tenant id');
    this.name = 'InvalidTenantError';
  }
}

export function assertTenantId(coopId: string): void {
  if (!UUID_RE.test(coopId)) throw new InvalidTenantError();
}

function coopColumn(table: TenantTable): PgColumn {
  return (table as unknown as { coop_id: PgColumn }).coop_id;
}

function withoutCoopId<V extends object>(values: V): V {
  if (!('coop_id' in values)) return values;
  const copy: Record<string, unknown> = { ...values };
  delete copy.coop_id;
  return copy as V;
}

export class TenantScope {
  constructor(
    /** Raw transaction. Escape hatch for joins / FOR UPDATE / aggregates: always add `this.owns(table)` for every tenant table. */
    readonly tx: Tx,
    readonly coopId: string,
  ) {}

  /** `table.coop_id = :coopId` — use in every hand-written query on a tenant table. */
  owns(table: TenantTable): SQL {
    return eq(coopColumn(table), this.coopId);
  }

  private scoped(table: TenantTable, where?: SQL): SQL {
    return where ? (and(this.owns(table), where) as SQL) : this.owns(table);
  }

  /**
   * Tenant-scoped select builder. Chain `.orderBy()`, `.limit()`, `.for('update')`… on the result.
   * Extra conditions go in `where` (do not call `.where()` again: it would replace the tenant predicate).
   */
  select<T extends TenantTable>(table: T, where?: SQL) {
    return (
      this.tx
        .select()
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- tsc needs it: generic T vs drizzle's conditional table type
        .from(table as PgTable)
        .where(this.scoped(table, where))
        .$dynamic()
    );
  }

  /** Typed, tenant-scoped list. `forUpdate` locks the rows until the transaction ends. */
  async list<T extends TenantTable>(
    table: T,
    options: {
      where?: SQL;
      orderBy?: (PgColumn | SQL)[];
      limit?: number;
      offset?: number;
      forUpdate?: boolean;
    } = {},
  ): Promise<Row<T>[]> {
    let query = this.select(table, options.where);
    if (options.orderBy?.length) query = query.orderBy(...options.orderBy);
    if (options.limit !== undefined) query = query.limit(options.limit);
    if (options.offset !== undefined) query = query.offset(options.offset);
    if (options.forUpdate) query = query.for('update');
    return (await query) as Row<T>[];
  }

  async findOne<T extends TenantTable>(table: T, where: SQL): Promise<Row<T> | undefined> {
    const rows = (await this.select(table, where).limit(1)) as Row<T>[];
    return rows[0];
  }

  /** Inserts rows owned by the current tenant. Any coop_id in `values` is overwritten. */
  async insert<T extends TenantTable>(table: T, values: NewRow<T>): Promise<Row<T>>;
  async insert<T extends TenantTable>(table: T, values: NewRow<T>[]): Promise<Row<T>[]>;
  async insert<T extends TenantTable>(
    table: T,
    values: NewRow<T> | NewRow<T>[],
  ): Promise<Row<T> | Row<T>[]> {
    const list = (Array.isArray(values) ? values : [values]).map((v) => ({
      ...v,
      coop_id: this.coopId,
    }));
    if (list.length === 0) return [];
    const rows = (await this.tx
      .insert(table as PgTable)
      // Drizzle cannot relate a generic table's insert type to NewRow<T> & coop_id; the public
      // signature above is what keeps callers type-safe.
      .values(list as never)
      .returning()) as Row<T>[];
    return Array.isArray(values) ? rows : (rows[0] as Row<T>);
  }

  /** Updates the current tenant's rows matching `where`. coop_id can never be changed. */
  async update<T extends TenantTable>(table: T, patch: Patch<T>, where: SQL): Promise<Row<T>[]> {
    const values = withoutCoopId(patch);
    // Nothing left to set (e.g. the patch only tried to change coop_id): no-op.
    if (Object.keys(values).length === 0) return (await this.select(table, where)) as Row<T>[];
    return (await this.tx
      .update(table as PgTable)
      .set(values as never)
      .where(this.scoped(table, where))
      .returning()) as Row<T>[];
  }

  /** Deletes the current tenant's rows matching `where`. */
  async delete<T extends TenantTable>(table: T, where: SQL): Promise<Row<T>[]> {
    return (await this.tx
      .delete(table as PgTable)
      .where(this.scoped(table, where))
      .returning()) as Row<T>[];
  }
}

/**
 * Runs `fn` in a transaction bound to one tenant. The transaction-local setting `app.coop_id` is
 * what the RLS policies of contracts/db/proposals/001_rls.sql check.
 */
export async function withTenant<R>(
  db: NodePgDatabase<Schema>,
  coopId: string,
  fn: (scope: TenantScope) => Promise<R>,
): Promise<R> {
  assertTenantId(coopId);
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.coop_id', ${coopId}, true)`);
    return fn(new TenantScope(tx, coopId));
  });
}
