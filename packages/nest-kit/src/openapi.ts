import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { problemDetails } from '@agricoop/shared';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { z } from 'zod';
import { PROBLEM_CONTENT_TYPE } from './problem/problem.filter.js';

export interface OpenApiOptions {
  title: string;
  version: string;
  description?: string;
}

/** Builds the OpenAPI document of a service (Zod DTOs included via nestjs-zod), normalized. */
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
  const document = SwaggerModule.createDocument(app, config, {
    // `ProduitsController.list` -> `Produits_list` -> Orval hook `useProduitsList`.
    operationIdFactory: (controllerKey: string, methodKey: string) =>
      `${controllerKey.replace(/Controller$/, '')}_${methodKey}`,
  });
  return normalizeOpenApi(cleanupOpenApiDoc(document));
}

/** Serves Swagger UI at `/<path>` (non-production only). */
export function setupSwaggerUi(
  app: INestApplication,
  document: OpenAPIObject,
  path = 'docs',
): void {
  SwaggerModule.setup(path, app, document);
}

/** `ProduitDto_Output` -> `Produit`, `ProduitCreateDto_Input` -> `ProduitCreateInput`. */
export function cleanSchemaName(name: string): string {
  return name
    .replace(/_Output$/, '')
    .replace(/_Input$/, 'Input')
    .replace(/Dto(?=Input$|$)/, '');
}

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'patch', 'head', 'options'] as const;

/**
 * Makes the generated document a usable contract:
 *  - clean, stable schema names (they become Orval type names);
 *  - every operation must declare an explicit 2xx response (throws otherwise);
 *  - every operation documents RFC 7807 `ProblemDetails` for 4XX / 5XX;
 *  - no dangling `$ref` (throws otherwise).
 */
export function normalizeOpenApi(doc: OpenAPIObject): OpenAPIObject {
  const schemas = doc.components?.schemas ?? {};
  let json = JSON.stringify(doc);
  for (const name of Object.keys(schemas)) {
    json = json.replaceAll(
      `"#/components/schemas/${name}"`,
      `"#/components/schemas/${cleanSchemaName(name)}"`,
    );
  }
  const out = JSON.parse(json) as OpenAPIObject;
  out.components ??= {};
  out.components.schemas = Object.fromEntries(
    Object.entries(out.components.schemas ?? {}).map(([k, v]) => [cleanSchemaName(k), v]),
  );
  out.components.schemas.ProblemDetails = z.toJSONSchema(problemDetails, {
    target: 'openapi-3.0',
  }) as never;

  const problem = {
    description: 'Problem details (RFC 7807)',
    content: {
      [PROBLEM_CONTENT_TYPE]: { schema: { $ref: '#/components/schemas/ProblemDetails' } },
    },
  };
  for (const [path, item] of Object.entries(out.paths)) {
    for (const method of HTTP_METHODS) {
      const op = item[method];
      if (!op) continue;
      const codes = Object.keys(op.responses ?? {});
      if (!codes.some((c) => /^2\d\d$/.test(c))) {
        throw new Error(
          `OpenAPI: ${method.toUpperCase()} ${path} has no explicit 2xx response; ` +
            'pass `status` to @ZodResponse / @ApiResponse',
        );
      }
      delete op.responses.default;
      op.responses['4XX'] = problem;
      op.responses['5XX'] = problem;
    }
  }

  const defined = new Set(Object.keys(out.components.schemas));
  const dangling = [...JSON.stringify(out).matchAll(/"#\/components\/schemas\/([^"]+)"/g)]
    .map((m) => m[1] ?? '')
    .filter((name) => !defined.has(name));
  if (dangling.length > 0) {
    throw new Error(`OpenAPI: dangling schema references: ${[...new Set(dangling)].join(', ')}`);
  }
  return out;
}
