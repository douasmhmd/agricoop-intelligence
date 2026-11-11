import { baseEnv } from '@agricoop/nest-kit';
import { z } from 'zod';

export const apiEnv = baseEnv.extend({
  PORT: z.coerce.number().int().positive().default(3000),
});
export type ApiEnv = z.infer<typeof apiEnv>;
