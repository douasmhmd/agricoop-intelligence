import { z } from 'zod';
import { realmRole } from '../enums.js';
import { uuid } from './common.js';

/** The caller as seen by the API (no personal data). */
export const meSchema = z.object({
  roles: z.array(realmRole),
  /** Cooperative of staff users; null for customers, resellers and platform admins. */
  coop_id: uuid.nullable(),
});
export type Me = z.infer<typeof meSchema>;
