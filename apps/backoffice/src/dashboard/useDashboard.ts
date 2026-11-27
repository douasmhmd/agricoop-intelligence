import { addDays, isoDateInZone } from '@agricoop/shared';
import { useQuery } from '@tanstack/react-query';
import { commandesList } from '@/api/generated/commandes/commandes';
import { lotsList } from '@/api/generated/lots/lots';
import { produitsList } from '@/api/generated/produits/produits';
import { ok } from '@/api/ok';
import { usePreferences } from '@/state/preferences';

/*
 * The API has no aggregate "dashboard" endpoint: figures are computed in the browser from the
 * existing lists, fetched page by page with a hard cap so a very large history stays bounded.
 * When the cap is hit, the card says the figure covers only the most recent orders.
 */
const PAGE_SIZE = 100;
const MAX_PAGES = 10;

/** Most recent orders, back to 60 days (two 30-day windows) or MAX_PAGES pages. */
export function useRecentOrders() {
  const { synthetic, adminCoopId } = usePreferences();
  return useQuery({
    queryKey: ['dashboard', 'orders', synthetic, adminCoopId],
    staleTime: 60_000,
    queryFn: async () => {
      const today = isoDateInZone(new Date());
      const oldest = addDays(today, -60);
      const items = [];
      let complete = false;
      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const res = ok(await commandesList({ page, pageSize: PAGE_SIZE, synthetic }));
        if (!res) break;
        items.push(...res.items);
        const last = res.items.at(-1);
        if (!last || page * PAGE_SIZE >= res.total) {
          complete = true;
          break;
        }
        if (isoDateInZone(new Date(last.date_commande)) < oldest) {
          complete = true;
          break;
        }
      }
      return { items, complete, today };
    },
  });
}

/** Available lots and the catalogue (for cost prices and familles). */
export function useStockData() {
  const { synthetic, adminCoopId } = usePreferences();
  return useQuery({
    queryKey: ['dashboard', 'stock', synthetic, adminCoopId],
    staleTime: 60_000,
    queryFn: async () => {
      const lots = [];
      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const res = ok(
          await lotsList({ page, pageSize: PAGE_SIZE, statut: 'disponible', synthetic }),
        );
        if (!res) break;
        lots.push(...res.items);
        if (page * PAGE_SIZE >= res.total) break;
      }
      const produits = ok(await produitsList({ synthetic })) ?? [];
      return { lots, produits };
    },
  });
}
