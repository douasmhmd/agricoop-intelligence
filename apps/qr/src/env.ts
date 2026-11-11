import { baseEnv } from '@agricoop/nest-kit';
import { z } from 'zod';

export const qrEnv = baseEnv.extend({
  PORT: z.coerce.number().int().positive().default(3001),
});
export type QrEnv = z.infer<typeof qrEnv>;
