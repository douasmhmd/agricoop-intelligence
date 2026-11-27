import { baseEnv } from '@agricoop/nest-kit';
import { z } from 'zod';

export const qrEnv = baseEnv.extend({
  PORT: z.coerce.number().int().positive().default(3001),
  /** Storefront origin encoded in labels: `${WEB_PUBLIC_URL}/v/<token>`. */
  WEB_PUBLIC_URL: z.url().default('http://localhost:5173'),
  QR_MAX_LABELS: z.coerce.number().int().min(1).default(5000),
  /** Public verification rate limit per client and minute. */
  QR_VERIFY_RATE_PER_MIN: z.coerce.number().int().min(1).default(30),
  QR_MAX_SCANS_UNITE: z.coerce.number().int().min(1).default(5),
  QR_LOT_SCAN_FACTOR: z.coerce.number().min(1).default(2),
  QR_MAX_VILLES_24H: z.coerce.number().int().min(1).default(2),
});
export type QrEnv = z.infer<typeof qrEnv>;
