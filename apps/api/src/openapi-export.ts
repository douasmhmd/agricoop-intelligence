/*
 * Writes this service's OpenAPI document to ./openapi.json. Run through `pnpm contracts:openapi`,
 * which merges every service document into contracts/api/openapi.yaml.
 * No database connection is opened: the pg pool is lazy.
 */
import 'reflect-metadata';
import { ANALYTICS_PREFIX_EXCLUDE } from './analytics/analytics.module';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildOpenApiDocument, configureApp, parseEnv } from '@agricoop/nest-kit';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule, GLOBAL_PREFIX } from './app.module';
import { apiEnv } from './env';
import { OPENAPI_INFO } from './openapi-info';

async function exportOpenApi(): Promise<void> {
  const env = parseEnv(apiEnv, {
    DATABASE_URL: 'postgres://openapi:export@localhost:1/none',
    LOG_LEVEL: 'silent',
    OIDC_ISSUER: 'http://localhost:8080/realms/agricoop',
  });
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.register(env),
    new FastifyAdapter(),
    { logger: false },
  );
  configureApp(app, {
    globalPrefix: GLOBAL_PREFIX,
    prefixExclude: ANALYTICS_PREFIX_EXCLUDE,
  });
  await app.init();
  const document = buildOpenApiDocument(app, OPENAPI_INFO);
  writeFileSync(join(process.cwd(), 'openapi.json'), `${JSON.stringify(document, null, 2)}\n`);
  await app.close();
}

void exportOpenApi();
