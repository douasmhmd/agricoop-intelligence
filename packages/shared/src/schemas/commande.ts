import { z } from 'zod';
import { canal, commandeStatut, famille, niveauQr, typeClient } from '../enums.js';
import { moneyString } from '../money.js';
import { coopCode, pagination, syntheticFilter, uuid } from './common.js';

/* ---------------------------------------------------------------------------------------------
 * Storefront (public)
 * ------------------------------------------------------------------------------------------- */

export const cooperativePubliqueSchema = z.object({
  code: coopCode,
  nom: z.string(),
  province: z.string(),
});
export type CooperativePublique = z.infer<typeof cooperativePubliqueSchema>;

/** A product as shown on the storefront: no cost, no margin. */
export const produitCatalogueSchema = z.object({
  produit_id: uuid,
  code: z.string(),
  nom: z.string(),
  famille,
  categorie: z.string(),
  prix_mad: moneyString,
  niveau_qr: niveauQr,
  /** Units that can be ordered now (stock of non-expired lots). */
  disponible: z.number().int(),
});
export type ProduitCatalogue = z.infer<typeof produitCatalogueSchema>;

/* ---------------------------------------------------------------------------------------------
 * Orders
 * ------------------------------------------------------------------------------------------- */

/**
 * Delivery details given at checkout. PERSONAL DATA: stored in client_pii only, never in events,
 * logs or analytics. The account e-mail comes from the verified token, not from this body.
 */
export const coordonneesSchema = z.object({
  nom: z.string().trim().min(2).max(120),
  telephone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ]{8,20}$/, 'Numéro de téléphone invalide')
    .optional(),
  adresse: z.string().trim().min(5).max(300),
  /** City (non-personal, kept on `client` for analytics). */
  ville: z.string().trim().min(2).max(80),
});
export type Coordonnees = z.infer<typeof coordonneesSchema>;

export const commandeCreateSchema = z.object({
  lignes: z
    .array(z.object({ produit_id: uuid, quantite: z.number().int().min(1).max(1000) }))
    .min(1)
    .max(50),
  coordonnees: coordonneesSchema,
});
export type CommandeCreate = z.infer<typeof commandeCreateSchema>;

export const ligneCommandeSchema = z.object({
  ligne_id: uuid,
  produit_id: uuid,
  produit_code: z.string(),
  produit_nom: z.string(),
  lot_id: uuid.nullable(),
  lot_numero: z.string().nullable(),
  quantite: z.number().int(),
  prix_unitaire_mad: moneyString,
  montant_mad: moneyString,
});
export type LigneCommande = z.infer<typeof ligneCommandeSchema>;

export const commandeSchema = z.object({
  commande_id: uuid,
  client_id: uuid,
  canal,
  date_commande: z.iso.datetime({ offset: true }),
  statut: commandeStatut,
  montant_total_mad: moneyString,
  lignes: z.array(ligneCommandeSchema),
  is_synthetic: z.boolean(),
});
export type Commande = z.infer<typeof commandeSchema>;

export const commandeCreeeSchema = commandeSchema.extend({
  paiement: z.object({
    /** Where to send the customer to pay (mock CMI gateway page in this MVP). */
    redirect_url: z.string(),
  }),
});
export type CommandeCreeeResponse = z.infer<typeof commandeCreeeSchema>;

/** Back-office view: the order plus the customer's details (operational plane only). */
export const commandeDetailSchema = commandeSchema.extend({
  client: z.object({
    type_client: typeClient,
    ville: z.string(),
    nom: z.string().nullable(),
    telephone: z.string().nullable(),
    email: z.string().nullable(),
    adresse: z.string().nullable(),
  }),
});
export type CommandeDetail = z.infer<typeof commandeDetailSchema>;

export const commandeResumeSchema = z.object({
  commande_id: uuid,
  client_id: uuid,
  canal,
  date_commande: z.iso.datetime({ offset: true }),
  statut: commandeStatut,
  montant_total_mad: moneyString,
  nb_lignes: z.number().int(),
  ville: z.string(),
  type_client: typeClient,
  is_synthetic: z.boolean(),
});
export type CommandeResume = z.infer<typeof commandeResumeSchema>;

export const commandePageSchema = z.object({
  items: z.array(commandeResumeSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
export type CommandePage = z.infer<typeof commandePageSchema>;

export const commandeListQuery = pagination.extend({
  statut: commandeStatut.optional(),
  canal: canal.optional(),
  synthetic: syntheticFilter,
});
export type CommandeListQuery = z.infer<typeof commandeListQuery>;

/** Back-office status change. `creee` is never a target. */
export const statutChangeSchema = z.object({
  statut: z.enum(['payee', 'expediee', 'livree', 'annulee']),
});
export type StatutChange = z.infer<typeof statutChangeSchema>;

/**
 * Hosted payment page of the CMI-style mock for an order (same origin as the storefront). Used by the
 * API (checkout redirect) and by the storefront ("pay again" after a refused payment).
 */
export function mockPaymentPath(coopCode: string, commandeId: string): string {
  return `/api/v1/coops/${encodeURIComponent(coopCode)}/paiements/mock/${commandeId}`;
}
