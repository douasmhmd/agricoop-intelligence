import { Inject, Injectable } from '@nestjs/common';
import {
  type CooperativeRow,
  type Database,
  findCooperativeByCode,
  type TenantScope,
  withTenant,
} from '@agricoop/db';
import { RequestContext } from './context/request-context.js';
import { DB } from './database.module.js';
import { Problems } from './problem/problem.js';

/**
 * Entry point for all tenant-scoped data access in business services:
 *
 *   this.tenantDb.run((scope) => scope.list(produit, { where: eq(produit.actif, true) }))
 *
 * The tenant comes from the request context (token / audited admin override) or, for storefront and
 * public flows, from the cooperative code in the URL — never from a request body.
 */
@Injectable()
export class TenantDb {
  constructor(@Inject(DB) private readonly db: Database) {}

  /** Runs `fn` in a transaction bound to the current request's tenant. */
  run<R>(fn: (scope: TenantScope) => Promise<R>): Promise<R> {
    return withTenant(this.db, RequestContext.requireTenant(), fn);
  }

  /**
   * Runs `fn` for a tenant resolved by a PUBLIC flow itself (QR record, payment callback…).
   * Never pass a coop_id that came from a request body.
   */
  runAs<R>(coopId: string, fn: (scope: TenantScope) => Promise<R>): Promise<R> {
    return withTenant(this.db, coopId, fn);
  }

  /** Resolves `/coops/:code` (404 `unknown_cooperative`). */
  async cooperative(code: string): Promise<CooperativeRow> {
    const coop = await findCooperativeByCode(this.db, code);
    if (!coop) throw Problems.unknownCooperative();
    return coop;
  }

  /** Runs `fn` in the tenant named by a cooperative code from the URL. */
  async runForCode<R>(
    code: string,
    fn: (scope: TenantScope, coop: CooperativeRow) => Promise<R>,
  ): Promise<R> {
    const coop = await this.cooperative(code);
    return withTenant(this.db, coop.coop_id, (scope) => fn(scope, coop));
  }
}
