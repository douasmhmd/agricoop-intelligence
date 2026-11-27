import {
  type DynamicModule,
  Global,
  Inject,
  Module,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { createDb, createPool, type DbConfig, type Pool } from '@agricoop/db';

/** Injection token for the pg Pool. */
export const DB_POOL = Symbol.for('agricoop.DB_POOL');
/** Injection token for the Drizzle database. */
export const DB = Symbol.for('agricoop.DB');

@Global()
@Module({})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(DB_POOL) private readonly pool: Pool) {}

  static forRoot(config: DbConfig): DynamicModule {
    return {
      module: DatabaseModule,
      global: true,
      providers: [
        { provide: DB_POOL, useFactory: () => createPool(config) },
        { provide: DB, inject: [DB_POOL], useFactory: (pool: Pool) => createDb(pool) },
      ],
      exports: [DB_POOL, DB],
    };
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
