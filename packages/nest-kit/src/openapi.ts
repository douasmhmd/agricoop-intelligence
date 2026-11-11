import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';

export interface OpenApiOptions {
  title: string;
  version: string;
  description?: string;
}

/** Builds the OpenAPI document of a service (Zod DTOs included via nestjs-zod). */
export function buildOpenApiDocument(
  app: INestApplication,
  options: OpenApiOptions,
): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle(options.title)
    .setVersion(options.version)
    .setDescription(options.description ?? '')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    .build();
  return cleanupOpenApiDoc(SwaggerModule.createDocument(app, config));
}

/** Serves Swagger UI at `/<path>` (non-production only). */
export function setupSwaggerUi(
  app: INestApplication,
  document: OpenAPIObject,
  path = 'docs',
): void {
  SwaggerModule.setup(path, app, document);
}
