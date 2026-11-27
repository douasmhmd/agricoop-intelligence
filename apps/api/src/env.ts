import { baseEnv } from '@agricoop/nest-kit';
import { z } from 'zod';
import { powerBiAllOrNone, powerBiEnvShape, POWERBI_REQUIRED } from './powerbi/config';

export const apiEnv = baseEnv
  .extend({
    PORT: z.coerce.number().int().positive().default(3000),
    /** Only the CMI-style mock exists in the MVP. */
    PAYMENT_PROVIDER: z.enum(['cmi-mock']).default('cmi-mock'),
    /** Derives each cooperative's mock store key. Must be set in production. */
    PAYMENT_MOCK_SECRET: z.string().min(16).default('dev-only-payment-mock-secret'),
    /** Mailpit locally. */
    SMTP_URL: z.string().default('smtp://localhost:1025'),
    MAIL_FROM: z.string().default('AgriCoop <no-reply@agricoop.local>'),
    /** Keycloak Admin API (platform admin: creating cooperatives). Without a secret, provisioning
     *  falls back to an in-memory stub (local development only). */
    KEYCLOAK_ADMIN_URL: z.url().default('http://localhost:8080'),
    KEYCLOAK_REALM: z.string().default('agricoop'),
    KC_PROVISIONER_CLIENT_ID: z.string().default('agricoop-provisioner'),
    KC_PROVISIONER_SECRET: z.string().optional(),
    /** Read-only connection to the data plane's `gold` schema (role analytics_reader, see
     *  data/bi/04_role_lecture.sql). Without it the /api/analytics endpoints answer 503. */
    ANALYTICS_DATABASE_URL: z.url().optional(),
    /** Power BI Embedded (service principal). None set = demo mode. See docs/powerbi-embedding.md. */
    ...powerBiEnvShape,
  })
  .refine(powerBiAllOrNone, {
    path: ['POWERBI_TENANT_ID'],
    message: `set all of ${POWERBI_REQUIRED.join(', ')} or none (demo mode)`,
  })
  .refine(
    (e) => e.NODE_ENV !== 'production' || e.PAYMENT_MOCK_SECRET !== 'dev-only-payment-mock-secret',
    {
      path: ['PAYMENT_MOCK_SECRET'],
      message: 'must be set in production',
    },
  );
export type ApiEnv = z.infer<typeof apiEnv>;
