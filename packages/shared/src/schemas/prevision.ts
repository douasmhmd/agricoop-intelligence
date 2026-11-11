import { z } from 'zod';
import { isoDate, syntheticFilter } from './common.js';

/** Model versions available in `prevision` (written back by the analytics plane), newest first. */
export const versionModeleSchema = z.object({
  version_modele: z.string(),
  date_calcul: z.iso.datetime({ offset: true }),
});
export type VersionModele = z.infer<typeof versionModeleSchema>;

export const previsionsQuery = z.object({
  /** Defaults to the most recently computed version. */
  version_modele: z.string().min(1).max(100).optional(),
  /** Monday of the first week (default: 26 weeks before today). */
  depuis: isoDate.optional(),
  /** Monday of the last week (default: 12 weeks after today). */
  jusqua: isoDate.optional(),
  /** Applies to actual sales (forecasts carry no synthetic flag). */
  synthetic: syntheticFilter,
});
export type PrevisionsQuery = z.infer<typeof previsionsQuery>;

export const previsionPointSchema = z.object({
  /** Monday of the week (Africa/Casablanca calendar). */
  semaine: isoDate,
  /** Forecast quantity (NUMERIC as string), null when the model has no value for that week. */
  quantite_prevue: z.string().nullable(),
  /** Units sold that week (lines of non-cancelled orders). */
  quantite_vendue: z.number().int(),
});
export type PrevisionPoint = z.infer<typeof previsionPointSchema>;

export const previsionSerieSchema = z.object({
  famille: z.string(),
  points: z.array(previsionPointSchema),
});

export const previsionsSchema = z.object({
  version_modele: z.string().nullable(),
  depuis: isoDate,
  jusqua: isoDate,
  series: z.array(previsionSerieSchema),
});
export type Previsions = z.infer<typeof previsionsSchema>;
