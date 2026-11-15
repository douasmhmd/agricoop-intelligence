import 'reflect-metadata';
import { ANALYTICS_PREFIX_EXCLUDE } from './analytics/analytics.module';
import { buildOpenApiDocument, configureApp, parseEnv, setupSwaggerUi } from '@agricoop/nest-kit';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule, GLOBAL_PREFIX } from './app.module';
import { apiEnv } from './env';
import { OPENAPI_INFO } from './openapi-info';

async function main(): Promise<void> {
  const env = parseEnv(apiEnv);
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.register(env),
    new FastifyAdapter({ trustProxy: true }),
    { bufferLogs: true },
  );
  configureApp(app, {
    globalPrefix: GLOBAL_PREFIX,
    prefixExclude: ANALYTICS_PREFIX_EXCLUDE,
    corsOrigins: env.CORS_ORIGINS,
  });
  if (env.NODE_ENV !== 'production') {
    setupSwaggerUi(app, buildOpenApiDocument(app, OPENAPI_INFO));
  }
  await app.listen(env.PORT, '0.0.0.0');
}

void main();
