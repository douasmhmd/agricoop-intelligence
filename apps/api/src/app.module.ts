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
import { ProduitsModule } from './produits/produits.module';

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
        ProduitsModule,
      ],
      controllers: [MeController],
    };
  }
}
