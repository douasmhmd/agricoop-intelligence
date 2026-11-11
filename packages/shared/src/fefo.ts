/*
 * FEFO allocation (first-expired-first-out). Pure function: the caller passes lots that are already
 * locked, non-expired and sorted by (date_peremption, lot_id); the allocation is deterministic.
 */

export interface FefoLot {
  lot_id: string;
  produit_id: string;
  stock: number;
}

export interface FefoAllocation {
  produit_id: string;
  lot_id: string;
  quantite: number;
}

export interface FefoShortage {
  produit_id: string;
  demande: number;
  disponible: number;
}

export interface FefoResult {
  allocations: FefoAllocation[];
  /** Products that cannot be fully served. Empty when the whole order fits. */
  manquants: FefoShortage[];
}

export function allocateFefo(
  lots: readonly FefoLot[],
  demande: ReadonlyMap<string, number>,
): FefoResult {
  const allocations: FefoAllocation[] = [];
  const manquants: FefoShortage[] = [];
  for (const [produitId, quantite] of demande) {
    if (!Number.isInteger(quantite) || quantite <= 0) {
      throw new RangeError(`Invalid quantity for ${produitId}`);
    }
    const candidates = lots.filter((l) => l.produit_id === produitId && l.stock > 0);
    const disponible = candidates.reduce((sum, l) => sum + l.stock, 0);
    if (disponible < quantite) {
      manquants.push({ produit_id: produitId, demande: quantite, disponible });
      continue;
    }
    let reste = quantite;
    for (const l of candidates) {
      if (reste === 0) break;
      const pris = Math.min(l.stock, reste);
      allocations.push({ produit_id: produitId, lot_id: l.lot_id, quantite: pris });
      reste -= pris;
    }
  }
  return manquants.length > 0 ? { allocations: [], manquants } : { allocations, manquants };
}

/** Sums the requested quantity per product (an order may list a product twice). */
export function aggregateDemande(
  lignes: readonly { produit_id: string; quantite: number }[],
): Map<string, number> {
  const demande = new Map<string, number>();
  for (const l of lignes) demande.set(l.produit_id, (demande.get(l.produit_id) ?? 0) + l.quantite);
  return demande;
}
