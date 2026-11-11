import { z } from 'zod';

/*
 * Domain enums mirrored from the CHECK constraints in contracts/db/schema.sql.
 * test/enums.test.ts parses schema.sql and fails if these drift.
 */

export const FAMILLES = ['alimentaire', 'cosmetique', 'coffret'] as const;
export const famille = z.enum(FAMILLES);
export type Famille = z.infer<typeof famille>;

export const NIVEAUX_QR = ['lot', 'unite'] as const;
export const niveauQr = z.enum(NIVEAUX_QR);
export type NiveauQr = z.infer<typeof niveauQr>;

export const QR_STATUTS = ['actif', 'desactive', 'signale'] as const;
export const qrStatut = z.enum(QR_STATUTS);
export type QrStatut = z.infer<typeof qrStatut>;

export const TYPES_CLIENT = ['particulier', 'revendeur'] as const;
export const typeClient = z.enum(TYPES_CLIENT);
export type TypeClient = z.infer<typeof typeClient>;

export const CANAUX = ['web', 'revendeur', 'direct'] as const;
export const canal = z.enum(CANAUX);
export type Canal = z.infer<typeof canal>;

export const COMMANDE_STATUTS = ['creee', 'payee', 'expediee', 'livree', 'annulee'] as const;
export const commandeStatut = z.enum(COMMANDE_STATUTS);
export type CommandeStatut = z.infer<typeof commandeStatut>;

export const TYPES_MOUVEMENT = ['entree', 'sortie', 'perte'] as const;
export const typeMouvement = z.enum(TYPES_MOUVEMENT);
export type TypeMouvement = z.infer<typeof typeMouvement>;

/** Allowed order status transitions: creee → payee → expediee → livree, annulee from creee/payee. */
export const COMMANDE_TRANSITIONS: Readonly<Record<CommandeStatut, readonly CommandeStatut[]>> = {
  creee: ['payee', 'annulee'],
  payee: ['expediee', 'annulee'],
  expediee: ['livree'],
  livree: [],
  annulee: [],
};

export function canTransition(from: CommandeStatut, to: CommandeStatut): boolean {
  return COMMANDE_TRANSITIONS[from].includes(to);
}

/*
 * Application-level enums (not CHECK constraints).
 */

/** Keycloak realm roles. */
export const REALM_ROLES = ['customer', 'reseller', 'coop_manager', 'saas_admin'] as const;
export const realmRole = z.enum(REALM_ROLES);
export type RealmRole = z.infer<typeof realmRole>;

/**
 * Coarse device class written to scan_qr.appareil. `Android` / `iPhone` match the values used by
 * the synthetic generator (data/synthetic-factory); `Autre` covers everything else.
 */
export const APPAREILS = ['Android', 'iPhone', 'Autre'] as const;
export const appareil = z.enum(APPAREILS);
export type Appareil = z.infer<typeof appareil>;
