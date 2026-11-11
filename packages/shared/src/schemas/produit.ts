import { z } from 'zod';
import { famille, niveauQr } from '../enums.js';
import { moneyString } from '../money.js';
import { uuid } from './common.js';

/**
 * Product as returned by the API. JSON keys keep the schema's snake_case French names.
 * coop_id is never part of a response: the tenant is implicit.
 */
export const produitSchema = z.object({
  produit_id: uuid,
  code: z.string(),
  nom: z.string(),
  famille,
  categorie: z.string(),
  prix_mad: moneyString,
  cout_mad: moneyString,
  conservation_j: z.number().int(),
  huile_ml_par_unite: z.number().int(),
  niveau_qr: niveauQr,
  actif: z.boolean(),
  is_synthetic: z.boolean(),
});
export type Produit = z.infer<typeof produitSchema>;
