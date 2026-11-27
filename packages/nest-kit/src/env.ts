import { z } from 'zod';

const booleanString = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

/** Environment variables common to every NestJS service. */
export const baseEnv = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  LOG_PRETTY: booleanString.default(false),
  DATABASE_URL: z.url(),
  /** Keycloak realm URL; must equal the `iss` of access tokens. */
  OIDC_ISSUER: z.url(),
  OIDC_AUDIENCE: z.string().min(1).default('agricoop-api'),
  /** Optional internal JWKS URL (e.g. http://keycloak:8080/...) when the issuer host is not reachable. */
  OIDC_JWKS_URL: z.url().optional(),
  /** Comma-separated list of allowed browser origins. */
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
});
export type BaseEnv = z.infer<typeof baseEnv>;

/**
 * Validates `source` against `schema`. The error lists offending variable names and reasons only,
 * never their values (they may be secrets).
 */
export function parseEnv<T extends z.ZodType>(
  schema: T,
  source: Record<string, string | undefined> = process.env,
): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`);
  }
  return result.data;
}
