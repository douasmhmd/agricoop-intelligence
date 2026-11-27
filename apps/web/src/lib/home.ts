/*
 * Home-page data shaping (pure, tested): category groups, featured selection, coop summaries.
 * Everything comes from the public storefront API — no invented reviews or numbers.
 */
import {
  type CooperativePublique,
  money,
  type ProduitCatalogue,
  toMoneyString,
} from '@agricoop/shared';
import type { PhotoKey } from './images';

export const GROUPES = ['huile', 'olives', 'soins', 'coffrets'] as const;
export type Groupe = (typeof GROUPES)[number];

export const GROUPE_PHOTO: Record<Groupe, PhotoKey> = {
  huile: 'huile',
  olives: 'olives',
  soins: 'savon',
  coffrets: 'coffret',
};

/** Which storefront group a product belongs to (null: shown in no group tile, e.g. infusions). */
export function groupeOf(p: Pick<ProduitCatalogue, 'categorie' | 'famille'>): Groupe | null {
  if (p.categorie === 'huile') return 'huile';
  if (p.categorie === 'olives_table') return 'olives';
  if (p.famille === 'cosmetique') return 'soins';
  if (p.famille === 'coffret') return 'coffrets';
  return null;
}

export type ProduitVitrine = ProduitCatalogue & { coop: CooperativePublique };

/**
 * Featured products: available ones only, alternating between cooperatives so one coop does not
 * fill the carousel, at most `limit`.
 */
export function selectFeatured(produits: ProduitVitrine[], limit = 10): ProduitVitrine[] {
  const byCoop = new Map<string, ProduitVitrine[]>();
  for (const p of produits) {
    if (p.disponible <= 0) continue;
    const list = byCoop.get(p.coop.code) ?? [];
    list.push(p);
    byCoop.set(p.coop.code, list);
  }
  const queues = [...byCoop.values()];
  const out: ProduitVitrine[] = [];
  for (let round = 0; out.length < limit && queues.some((q) => q.length > round); round += 1) {
    for (const q of queues) {
      const p = q[round];
      if (p && out.length < limit) out.push(p);
    }
  }
  return out;
}

export interface GroupeSummary {
  groupe: Groupe;
  count: number;
  /** The cooperative with the most products in this group (where the tile leads), if any. */
  coopCode: string | null;
}

export function summarizeGroupes(produits: ProduitVitrine[]): GroupeSummary[] {
  return GROUPES.map((groupe) => {
    const inGroup = produits.filter((p) => groupeOf(p) === groupe);
    const perCoop = new Map<string, number>();
    for (const p of inGroup) perCoop.set(p.coop.code, (perCoop.get(p.coop.code) ?? 0) + 1);
    const best = [...perCoop.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    return { groupe, count: inGroup.length, coopCode: best?.[0] ?? null };
  });
}

export interface CoopSummary {
  coop: CooperativePublique;
  produits: number;
  familles: ProduitCatalogue['famille'][];
  /** Lowest price among available products, as a money string. */
  prixMin: string | null;
}

export function summarizeCoop(
  coop: CooperativePublique,
  produits: ProduitCatalogue[],
): CoopSummary {
  const disponibles = produits.filter((p) => p.disponible > 0);
  const prixMin = disponibles.reduce<ReturnType<typeof money> | null>((min, p) => {
    const prix = money(p.prix_mad);
    return min === null || prix.lessThan(min) ? prix : min;
  }, null);
  return {
    coop,
    produits: produits.length,
    familles: [...new Set(produits.map((p) => p.famille))],
    prixMin: prixMin ? toMoneyString(prixMin) : null,
  };
}
