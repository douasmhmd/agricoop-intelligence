import { z } from 'zod';
import { coopCode, uuid } from './common.js';

/** Platform admin view of a cooperative (tenant). */
export const cooperativeAdminSchema = z.object({
  coop_id: uuid,
  code: z.string(),
  nom: z.string(),
  province: z.string(),
  is_synthetic: z.boolean(),
  created_at: z.iso.datetime({ offset: true }),
});
export type CooperativeAdmin = z.infer<typeof cooperativeAdminSchema>;

/**
 * New tenant + its first manager account. The manager's details go to Keycloak only (personal data is
 * not stored by the platform API); Keycloak e-mails them a link to set their password.
 */
export const cooperativeCreateSchema = z.object({
  code: coopCode,
  nom: z.string().trim().min(3).max(120),
  province: z.string().trim().min(2).max(80),
  gestionnaire: z.object({
    email: z.email(),
    prenom: z.string().trim().min(1).max(60),
    nom: z.string().trim().min(1).max(60),
  }),
});
export type CooperativeCreate = z.infer<typeof cooperativeCreateSchema>;
