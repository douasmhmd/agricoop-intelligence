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
import { qrEnv } from '../../src/env';

/** Boots the real qr module against a test database, with tokens from a local test issuer. */
export async function createQrTestApp(
  db: TestDatabase,
  issuer: TestIssuer,
  options: { clock?: Clock; env?: Record<string, string> } = {},
): Promise<NestFastifyApplication> {
  const env = parseEnv(qrEnv, {
    DATABASE_URL: db.appUrl,
    LOG_LEVEL: 'silent',
    OIDC_ISSUER: issuer.issuer,
    OIDC_AUDIENCE: issuer.audience,
    WEB_PUBLIC_URL: 'https://boutique.agricoop.test',
    ...options.env,
  });
  let builder = Test.createTestingModule({ imports: [AppModule.register(env)] })
    .overrideProvider(JWT_VERIFIER)
    .useValue(createJwtVerifier({ issuer: issuer.issuer, audience: issuer.audience }, issuer.jwks));
  if (options.clock) builder = builder.overrideProvider(CLOCK).useValue(options.clock);
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter({ trustProxy: true }),
    { logger: false },
  );
  configureApp(app, { globalPrefix: GLOBAL_PREFIX });
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}
