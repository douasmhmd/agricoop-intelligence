import { type DynamicModule, Module } from '@nestjs/common';
import { pingDb, type Pool } from '@agricoop/db';
import {
  CoreModule,
  createLoggerParams,
  DatabaseModule,
  DB_POOL,
  HealthModule,
  MetricsModule,
} from '@agricoop/nest-kit';
import { LoggerModule } from 'nestjs-pino';
import type { ApiEnv } from './env';
import { MeController } from './me/me.controller';
import { PrevisionsModule } from './previsions/previsions.controller';
import { AdminModule } from './admin/admin.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { PowerBiModule } from './powerbi/powerbi.module';
import { CatalogueModule } from './catalogue/catalogue.module';
import { CommandesModule } from './commandes/commandes.module';
import { StockModule } from './stock/stock.module';

export const SERVICE_NAME = 'agricoop-api';
export const GLOBAL_PREFIX = 'api/v1';

@Module({})
export class AppModule {
  static register(env: ApiEnv): DynamicModule {
    return {
      module: AppModule,
      imports: [
        LoggerModule.forRoot(
          createLoggerParams({
            serviceName: SERVICE_NAME,
            level: env.LOG_LEVEL,
            pretty: env.LOG_PRETTY,
          }),
        ),
        DatabaseModule.forRoot({
          connectionString: env.DATABASE_URL,
          applicationName: SERVICE_NAME,
        }),
        CoreModule.forRoot({
          oidc: {
            issuer: env.OIDC_ISSUER,
            audience: env.OIDC_AUDIENCE,
            ...(env.OIDC_JWKS_URL ? { jwksUrl: env.OIDC_JWKS_URL } : {}),
          },
        }),
        MetricsModule.forRoot({ serviceName: SERVICE_NAME }),
        HealthModule.forRootAsync({
          inject: [DB_POOL],
          useFactory: (pool: Pool) => [{ name: 'database', check: () => pingDb(pool) }],
        }),
        CatalogueModule,
        StockModule,
        CommandesModule.register(env),
        PrevisionsModule,
        AdminModule.register(env),
        AnalyticsModule.register(env),
        PowerBiModule.register(env),
      ],
      controllers: [MeController],
    };
  }
}
