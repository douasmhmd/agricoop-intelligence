/*
 * Analytics API (read-only, over the data plane's `gold` schema).
 * Contract: contracts/api/analytics.yaml, written by the data plane. These schemas mirror it field
 * by field; amounts are JSON numbers there (aggregates for display, not ledger amounts).
 */
import { z } from 'zod';
import { famille } from '../enums.js';
import { isoDate, uuid } from './common.js';

export const CAMPAGNE_PATTERN = /^\d{4}-\d{4}$/;

export const kpiMensuelQuery = z.object({
  /** Olive campaign, October → September, e.g. "2025-2026". */
  campagne: z
    .string()
    .regex(CAMPAGNE_PATTERN)
    .refine((v) => Number(v.slice(5)) === Number(v.slice(0, 4)) + 1, 'consecutive years')
    .optional(),
});

export const kpiMensuelSchema = z.object({
  mois: isoDate,
  commandes: z.number().int(),
  ca_mad: z.number(),
  marge_mad: z.number(),
  taux_marge: z.number(),
  panier_moyen_mad: z.number(),
  clients_actifs: z.number().int(),
  nouveaux_clients: z.number().int(),
});
export type KpiMensuel = z.infer<typeof kpiMensuelSchema>;

export const NIVEAUX_ALERTE_STOCK = ['rupture', 'critique', 'attention', 'ok'] as const;
export const stockProduitSchema = z.object({
  produit: z.string(),
  famille,
  stock_disponible: z.number().int(),
  vente_moy_jour: z.number(),
  couverture_jours: z.number().int().nullable(),
  niveau_alerte: z.enum(NIVEAUX_ALERTE_STOCK),
});
export type StockProduit = z.infer<typeof stockProduitSchema>;

export const lotSurveilleSchema = z.object({
  produit: z.string(),
  lot: z.string(),
  date_peremption: isoDate,
  stock_actuel: z.number().int(),
  jours_avant_peremption: z.number().int(),
});
export type LotSurveille = z.infer<typeof lotSurveilleSchema>;

export const risqueInvenduSchema = z.object({
  produit: z.string(),
  lot: z.string(),
  date_peremption: isoDate,
  stock_actuel: z.number().int(),
  vente_moy_jour: z.number(),
  unites_a_risque: z.number().int(),
  valeur_a_risque_mad: z.number(),
});
export type RisqueInvendu = z.infer<typeof risqueInvenduSchema>;

export const previsionAnalyticsQuery = z.object({ famille: famille.optional() });
export const previsionAnalyticsSchema = z.object({
  famille,
  semaine: isoDate,
  quantite_prevue: z.number(),
  ventes: z.number().int().nullable(),
  ecart: z.number().nullable(),
  semaine_a_venir: z.boolean(),
  version_modele: z.string(),
});
export type PrevisionAnalytics = z.infer<typeof previsionAnalyticsSchema>;

export const NIVEAUX_ALERTE_QR = ['signalé', 'à vérifier'] as const;
export const alertesQrQuery = z.object({ niveau: z.enum(NIVEAUX_ALERTE_QR).optional() });
export const alerteQrSchema = z.object({
  qr_id: uuid,
  niveau: z.enum(NIVEAUX_ALERTE_QR),
  nb_scans: z.number().int(),
  nb_villes: z.number().int(),
  distance_max_km: z.number(),
  duree_jours: z.number(),
  date_analyse: isoDate,
});
export type AlerteQr = z.infer<typeof alerteQrSchema>;

export const SEGMENTS = [
  'Revendeurs',
  'Fidèles',
  'À réactiver',
  'Récents',
  'Occasionnels inactifs',
] as const;
export const segmentParam = z.object({ segment: z.enum(SEGMENTS) });
export const segmentSchema = z.object({
  segment: z.string(),
  clients: z.number().int(),
  part_clients: z.number(),
  part_ca: z.number(),
});
export type Segment = z.infer<typeof segmentSchema>;

export const clientSegmentSchema = z.object({
  client_id: uuid,
  recence_j: z.number().int(),
  frequence: z.number().int(),
  montant_mad: z.number(),
});
export type ClientSegment = z.infer<typeof clientSegmentSchema>;

export const anomalieStockSchema = z.object({
  produit: z.string(),
  lot: z.string(),
  stock_actuel: z.number().int(),
  anomalie: z.string(),
});
export type AnomalieStock = z.infer<typeof anomalieStockSchema>;

/** Stock alert level computed by the API (contract: rupture / critique / attention / ok). */
export function niveauAlerteStock(
  stockDisponible: number,
  couvertureJours: number | null,
): (typeof NIVEAUX_ALERTE_STOCK)[number] {
  if (stockDisponible <= 0) return 'rupture';
  if (couvertureJours === null) return 'ok'; // no recent sales
  if (couvertureJours < 14) return 'critique';
  if (couvertureJours <= 30) return 'attention';
  return 'ok';
}

/** First and last month (1st of month) of an olive campaign "YYYY-YYYY" (October → September). */
export function campagneBounds(campagne: string): { debut: string; fin: string } {
  const start = Number(campagne.slice(0, 4));
  return { debut: `${start}-10-01`, fin: `${start + 1}-09-01` };
}
