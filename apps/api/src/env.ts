import { baseEnv } from '@agricoop/nest-kit';
import { z } from 'zod';

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
  })
  .refine(
    (e) => e.NODE_ENV !== 'production' || e.PAYMENT_MOCK_SECRET !== 'dev-only-payment-mock-secret',
    {
      path: ['PAYMENT_MOCK_SECRET'],
      message: 'must be set in production',
    },
  );
export type ApiEnv = z.infer<typeof apiEnv>;
