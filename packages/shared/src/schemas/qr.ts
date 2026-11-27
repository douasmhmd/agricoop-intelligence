import { z } from 'zod';
import { famille, niveauQr, qrStatut } from '../enums.js';
import { isoDate, pagination, uuid } from './common.js';

/** Why a scan is not plainly "authentic" (same codes as the qr_scanne event). */
export const QR_ALERTES = [
  'qr_inactif',
  'lot_perime',
  'scans_multiples',
  'villes_multiples',
] as const;
export const qrAlerte = z.enum(QR_ALERTES);
export type QrAlerte = z.infer<typeof qrAlerte>;

/* ---------------------------------------------------------------------------------------------
 * Public verification (/v/:token)
 * ------------------------------------------------------------------------------------------- */

export const verificationSchema = z.object({
  /** `authentique` when no alert; otherwise `alerte` (the page shows "Attention"). */
  resultat: z.enum(['authentique', 'alerte']),
  alertes: z.array(qrAlerte),
  statut_qr: qrStatut,
  niveau: niveauQr,
  produit: z.object({ nom: z.string(), famille, categorie: z.string() }),
  cooperative: z.object({ code: z.string(), nom: z.string(), province: z.string() }),
  lot: z.object({ numero: z.string(), date_fabrication: isoDate, date_peremption: isoDate }),
  /** Serial number for unit-level codes, null for lot-level codes. */
  numero_serie: z.number().int().nullable(),
  /** Scans of this code so far, including this one. */
  nb_scans: z.number().int(),
});
export type Verification = z.infer<typeof verificationSchema>;

/* ---------------------------------------------------------------------------------------------
 * Back office
 * ------------------------------------------------------------------------------------------- */

export const qrGenerateQuery = z.object({
  /** Deactivate the lot's active codes and issue new ones (tokens cannot be re-printed). */
  regenerer: z.enum(['true', 'false']).default('false'),
});
export type QrGenerateQuery = z.infer<typeof qrGenerateQuery>;

export const qrCodeSchema = z.object({
  qr_id: uuid,
  niveau: niveauQr,
  statut: qrStatut,
  lot_id: uuid,
  lot_numero: z.string(),
  unite_id: uuid.nullable(),
  numero_serie: z.number().int().nullable(),
  produit_code: z.string(),
  created_at: z.iso.datetime({ offset: true }),
  nb_scans: z.number().int(),
  nb_villes: z.number().int(),
  dernier_scan: z.iso.datetime({ offset: true }).nullable(),
  /** Current anomaly assessment (scan count / cities in the last 24 h). */
  alertes: z.array(qrAlerte),
  is_synthetic: z.boolean(),
});
export type QrCode = z.infer<typeof qrCodeSchema>;

export const qrCodePageSchema = z.object({
  items: z.array(qrCodeSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
export type QrCodePage = z.infer<typeof qrCodePageSchema>;

export const qrListQuery = pagination.extend({
  lot_id: uuid.optional(),
  statut: qrStatut.optional(),
});
export type QrListQuery = z.infer<typeof qrListQuery>;

export const qrStatutChangeSchema = z.object({ statut: qrStatut });
export type QrStatutChange = z.infer<typeof qrStatutChangeSchema>;

export const scanSchema = z.object({
  scan_id: uuid,
  date_scan: z.iso.datetime({ offset: true }),
  ville: z.string().nullable(),
  appareil: z.string().nullable(),
  is_synthetic: z.boolean(),
});
export type Scan = z.infer<typeof scanSchema>;

export const scansParVilleQuery = z.object({
  jours: z.coerce.number().int().min(1).max(365).default(30),
});
export type ScansParVilleQuery = z.infer<typeof scansParVilleQuery>;

export const scansParVilleSchema = z.object({
  ville: z.string(),
  nb_scans: z.number().int(),
  nb_qr: z.number().int(),
});
export type ScansParVille = z.infer<typeof scansParVilleSchema>;
