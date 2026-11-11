import { z } from 'zod';
import { niveauQr, typeMouvement } from '../enums.js';
import { isoDate, pagination, syntheticFilter, uuid } from './common.js';

export const LOT_STATUTS = ['disponible', 'epuise', 'perime'] as const;
/** epuise: stock 0 · perime: stock > 0 and expired · disponible: stock > 0, not expired. */
export const lotStatut = z.enum(LOT_STATUTS);
export type LotStatut = z.infer<typeof lotStatut>;

export const lotSchema = z.object({
  lot_id: uuid,
  produit_id: uuid,
  produit_code: z.string(),
  produit_nom: z.string(),
  niveau_qr: niveauQr,
  numero: z.string(),
  date_fabrication: isoDate,
  date_peremption: isoDate,
  quantite_initiale: z.number().int(),
  stock: z.number().int(),
  statut: lotStatut,
  is_synthetic: z.boolean(),
});
export type Lot = z.infer<typeof lotSchema>;

export const lotPageSchema = z.object({
  items: z.array(lotSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
export type LotPage = z.infer<typeof lotPageSchema>;

export const lotCreateSchema = z
  .object({
    produit_id: uuid,
    numero: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9][A-Za-z0-9_/-]{1,63}$/, 'Numéro de lot invalide'),
    date_fabrication: isoDate,
    /** Defaults to date_fabrication + produit.conservation_j. */
    date_peremption: isoDate.optional(),
    quantite_initiale: z.number().int().min(1).max(100_000),
  })
  .refine((v) => !v.date_peremption || v.date_peremption > v.date_fabrication, {
    path: ['date_peremption'],
    message: 'La date de péremption doit être postérieure à la date de fabrication',
  });
export type LotCreate = z.infer<typeof lotCreateSchema>;

export const lotListQuery = pagination.extend({
  produit_id: uuid.optional(),
  statut: lotStatut.optional(),
  synthetic: syntheticFilter,
});
export type LotListQuery = z.infer<typeof lotListQuery>;

export const mouvementSchema = z.object({
  mouvement_id: uuid,
  lot_id: uuid,
  type_mouvement: typeMouvement,
  quantite: z.number().int(),
  date_mouvement: z.iso.datetime({ offset: true }),
  is_synthetic: z.boolean(),
});
export type Mouvement = z.infer<typeof mouvementSchema>;

export const perteCreateSchema = z.object({
  quantite: z.number().int().min(1),
});
export type PerteCreate = z.infer<typeof perteCreateSchema>;

export const perteResultSchema = z.object({
  mouvement: mouvementSchema,
  stock_apres: z.number().int(),
});
export type PerteResult = z.infer<typeof perteResultSchema>;

export const ALERTE_NIVEAUX = ['perime', 'j30', 'j60', 'j90'] as const;
export const alertePeremptionSchema = lotSchema.extend({
  /** Days until date_peremption (≤ 0 when expired). */
  jours_restants: z.number().int(),
  niveau: z.enum(ALERTE_NIVEAUX),
});
export type AlertePeremption = z.infer<typeof alertePeremptionSchema>;

export const alertesQuery = z.object({
  /** Horizon in days: 30, 60 or 90 (default 90). Expired lots with stock are always included. */
  jours: z.enum(['30', '60', '90']).default('90').transform(Number),
  synthetic: syntheticFilter,
});
export type AlertesQuery = z.infer<typeof alertesQuery>;
