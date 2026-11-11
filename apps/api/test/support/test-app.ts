import 'reflect-metadata';
import {
  CLOCK,
  type Clock,
  configureApp,
  createJwtVerifier,
  JWT_VERIFIER,
  parseEnv,
} from '@agricoop/nest-kit';
import type { TestDatabase, TestIssuer } from '@agricoop/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppModule, GLOBAL_PREFIX } from '../../src/app.module';
import { apiEnv } from '../../src/env';

/** Boots the real api module against a test database, with tokens from a local test issuer. */
export interface TestAppOverrides {
  /** Pin "now" (and therefore the business date). */
  clock?: Clock;
}

export async function createTestApp(
  db: TestDatabase,
  issuer: TestIssuer,
  overrides: TestAppOverrides = {},
): Promise<NestFastifyApplication> {
  const env = parseEnv(apiEnv, {
    DATABASE_URL: db.appUrl,
    LOG_LEVEL: 'silent',
    OIDC_ISSUER: issuer.issuer,
    OIDC_AUDIENCE: issuer.audience,
  });
  let builder = Test.createTestingModule({ imports: [AppModule.register(env)] })
    .overrideProvider(JWT_VERIFIER)
    .useValue(createJwtVerifier({ issuer: issuer.issuer, audience: issuer.audience }, issuer.jwks));
  if (overrides.clock) builder = builder.overrideProvider(CLOCK).useValue(overrides.clock);
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), {
    logger: false,
  });
  configureApp(app, { globalPrefix: GLOBAL_PREFIX });
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}
