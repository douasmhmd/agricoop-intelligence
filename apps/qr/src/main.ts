import 'reflect-metadata';
import { buildOpenApiDocument, configureApp, parseEnv, setupSwaggerUi } from '@agricoop/nest-kit';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule, GLOBAL_PREFIX } from './app.module';
import { qrEnv } from './env';
import { OPENAPI_INFO } from './openapi-info';

async function main(): Promise<void> {
  const env = parseEnv(qrEnv);
  // Read by the @Throttle resolver of the public verification route.
  process.env.QR_VERIFY_RATE_PER_MIN = String(env.QR_VERIFY_RATE_PER_MIN);
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.register(env),
    new FastifyAdapter({ trustProxy: true }),
    { bufferLogs: true },
  );
  configureApp(app, { globalPrefix: GLOBAL_PREFIX, corsOrigins: env.CORS_ORIGINS });
  if (env.NODE_ENV !== 'production') {
    setupSwaggerUi(app, buildOpenApiDocument(app, OPENAPI_INFO));
  }
  await app.listen(env.PORT, '0.0.0.0');
}

void main();
