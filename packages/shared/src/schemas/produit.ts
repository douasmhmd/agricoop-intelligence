import { z } from 'zod';
import { famille, niveauQr } from '../enums.js';
import { moneyString, positiveMoneyString } from '../money.js';
import { syntheticFilter, uuid } from './common.js';

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
  /** prix_mad − cout_mad (may be negative). */
  marge_mad: z.string().regex(/^-?\d+\.\d{2}$/),
  /** Margin as a percentage of the price, one decimal, e.g. "45.0". */
  marge_pct: z.string().nullable(),
  conservation_j: z.number().int(),
  huile_ml_par_unite: z.number().int(),
  niveau_qr: niveauQr,
  actif: z.boolean(),
  is_synthetic: z.boolean(),
});
export type Produit = z.infer<typeof produitSchema>;

const code = z
  .string()
  .trim()
  .regex(/^[A-Z0-9][A-Z0-9_-]{1,31}$/, 'Code produit : majuscules, chiffres, - ou _ (2 à 32)');

export const produitCreateSchema = z.object({
  code,
  nom: z.string().trim().min(2).max(120),
  famille,
  categorie: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9_]{1,39}$/, 'Catégorie : minuscules et _, ex. huile, olives_table'),
  prix_mad: positiveMoneyString,
  cout_mad: moneyString,
  conservation_j: z.number().int().min(1).max(3650),
  huile_ml_par_unite: z.number().int().min(0).max(100_000).default(0),
  niveau_qr: niveauQr,
  actif: z.boolean().default(true),
});
export type ProduitCreate = z.infer<typeof produitCreateSchema>;

/** Partial update. `niveau_qr` can only change while the product has no lot. */
export const produitUpdateSchema = z
  .object({
    code: code.optional(),
    nom: z.string().trim().min(2).max(120).optional(),
    famille: famille.optional(),
    categorie: produitCreateSchema.shape.categorie.optional(),
    prix_mad: positiveMoneyString.optional(),
    cout_mad: moneyString.optional(),
    conservation_j: z.number().int().min(1).max(3650).optional(),
    huile_ml_par_unite: z.number().int().min(0).max(100_000).optional(),
    niveau_qr: niveauQr.optional(),
    actif: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Aucun champ à modifier');
export type ProduitUpdate = z.infer<typeof produitUpdateSchema>;

export const produitListQuery = z.object({
  famille: famille.optional(),
  actif: z.enum(['true', 'false']).optional(),
  synthetic: syntheticFilter,
});
export type ProduitListQuery = z.infer<typeof produitListQuery>;
