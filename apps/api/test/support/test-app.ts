import 'reflect-metadata';
import { ANALYTICS_PREFIX_EXCLUDE } from '../../src/analytics/analytics.module';
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
import {
  NOTIFICATION_PROVIDER,
  type NotificationProvider,
} from '../../src/notifications/notifications';

/** Boots the real api module against a test database, with tokens from a local test issuer. */
export interface TestAppOverrides {
  /** Pin "now" (and therefore the business date). */
  clock?: Clock;
  /** Capture notifications instead of sending e-mail. */
  notifications?: NotificationProvider;
  /** Any other provider replacement, e.g. the identity admin. */
  providers?: { token: symbol | string; value: unknown }[];
  /** Read-only connection to the `gold` schema (enables /api/analytics). */
  analyticsUrl?: string;
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
    ...(overrides.analyticsUrl ? { ANALYTICS_DATABASE_URL: overrides.analyticsUrl } : {}),
  });
  let builder = Test.createTestingModule({ imports: [AppModule.register(env)] })
    .overrideProvider(JWT_VERIFIER)
    .useValue(createJwtVerifier({ issuer: issuer.issuer, audience: issuer.audience }, issuer.jwks));
  if (overrides.clock) builder = builder.overrideProvider(CLOCK).useValue(overrides.clock);
  if (overrides.notifications) {
    builder = builder.overrideProvider(NOTIFICATION_PROVIDER).useValue(overrides.notifications);
  }
  for (const p of overrides.providers ?? [])
    builder = builder.overrideProvider(p.token).useValue(p.value);
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), {
    logger: false,
  });
  configureApp(app, {
    globalPrefix: GLOBAL_PREFIX,
    prefixExclude: ANALYTICS_PREFIX_EXCLUDE,
  });
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}
