import { type UseQueryResult, useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';
import {
  getStorefrontCatalogueQueryOptions,
  type storefrontCatalogueResponse,
  useStorefrontList,
} from '@/api/generated/storefront/storefront';
import { ok } from '@/api/ok';
import { type CoopSummary, type ProduitVitrine, summarizeCoop } from '@/lib/home';

type CatalogueResult = UseQueryResult<storefrontCatalogueResponse, unknown>;

// Stable reference: TanStack Query then memoizes the combined result between renders.
function combine(results: CatalogueResult[]) {
  return {
    data: results.map((r) => r.data),
    pending: results.some((r) => r.isPending),
  };
}

/** Cooperatives and every cooperative's catalogue (a handful of public, cached requests). */
export function useHomeData() {
  const coopsQuery = useStorefrontList();
  const coops = useMemo(() => ok(coopsQuery.data) ?? [], [coopsQuery.data]);
  const catalogues = useQueries({
    queries: coops.map((c) => getStorefrontCatalogueQueryOptions(c.code)),
    combine,
  });

  const { produits, summaries } = useMemo(() => {
    const produits: ProduitVitrine[] = [];
    const summaries: CoopSummary[] = [];
    coops.forEach((coop, i) => {
      const list = ok(catalogues.data[i]) ?? [];
      for (const p of list) produits.push({ ...p, coop });
      summaries.push(summarizeCoop(coop, list));
    });
    return { produits, summaries };
  }, [coops, catalogues.data]);

  return { coopsQuery, coops, produits, summaries, cataloguesPending: catalogues.pending };
}
