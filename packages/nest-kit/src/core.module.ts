import { type DynamicModule, Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type { Database } from '@agricoop/db';
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod';
import { AccessGuard } from './auth/access.guard.js';
import { createJwtVerifier, JWT_VERIFIER, type OidcOptions } from './auth/jwt-verifier.js';
import { createDbTenantDirectory, TENANT_DIRECTORY } from './auth/tenant-directory.js';
import { RequestContextInterceptor } from './context/request-context.js';
import { DB } from './database.module.js';
import { ProblemDetailsFilter } from './problem/problem.filter.js';
import { TenantDb } from './tenant-db.js';

export interface CoreModuleOptions {
  oidc: OidcOptions;
  /** Default rate limit per client and minute (stricter limits are set per route). */
  rateLimitPerMinute?: number;
}

/**
 * Cross-cutting request pipeline shared by api and qr. Global, in this order:
 *   ThrottlerGuard → AccessGuard (auth → roles → tenant) → RequestContextInterceptor
 *   → ZodValidationPipe → handler → ProblemDetailsFilter on any error.
 * Requires DatabaseModule.
 */
@Global()
@Module({})
export class CoreModule {
  static forRoot(options: CoreModuleOptions): DynamicModule {
    return {
      module: CoreModule,
      global: true,
      imports: [
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: options.rateLimitPerMinute ?? 300 }]),
      ],
      providers: [
        { provide: JWT_VERIFIER, useFactory: () => createJwtVerifier(options.oidc) },
        {
          provide: TENANT_DIRECTORY,
          inject: [DB],
          useFactory: (db: Database) => createDbTenantDirectory(db),
        },
        TenantDb,
        // Global guards run in registration order.
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: APP_GUARD, useClass: AccessGuard },
        { provide: APP_INTERCEPTOR, useClass: RequestContextInterceptor },
        // Validates and strips every response against its @ZodResponse schema (no stray fields leak).
        { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
        { provide: APP_PIPE, useClass: ZodValidationPipe },
        { provide: APP_FILTER, useClass: ProblemDetailsFilter },
      ],
      exports: [TenantDb, JWT_VERIFIER, TENANT_DIRECTORY],
    };
  }
}
