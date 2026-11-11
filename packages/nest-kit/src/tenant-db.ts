import { Inject, Injectable } from '@nestjs/common';
import { type Database, type TenantScope, withTenant } from '@agricoop/db';
import { RequestContext } from './context/request-context.js';
import { DB } from './database.module.js';

/**
 * Entry point for all tenant-scoped data access in business services:
 *
 *   this.tenantDb.run((scope) => scope.select(produit, eq(produit.actif, true)))
 *
 * The tenant comes from the request context (token / audited admin override) — never from a
 * request body or a method parameter.
 */
@Injectable()
export class TenantDb {
  constructor(@Inject(DB) private readonly db: Database) {}

  /** Runs `fn` in a transaction bound to the current request's tenant. */
  run<R>(fn: (scope: TenantScope) => Promise<R>): Promise<R> {
    return withTenant(this.db, RequestContext.requireTenant(), fn);
  }

  /**
   * Runs `fn` for a tenant resolved by a PUBLIC flow itself (cooperative code in the URL, QR record).
   * Never pass a coop_id that came from a request body.
   */
  runAs<R>(coopId: string, fn: (scope: TenantScope) => Promise<R>): Promise<R> {
    return withTenant(this.db, coopId, fn);
  }
}
