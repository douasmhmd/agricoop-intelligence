import { lineTotal, sumMoney } from '@agricoop/shared';
import { createContext, type ReactNode, useContext, useMemo, useState } from 'react';

/*
 * Shopping cart, kept in localStorage (best effort). An order is placed with ONE cooperative, so the
 * cart holds products of a single cooperative at a time. Prices shown here are indicative: the API
 * applies the current price when the order is placed.
 */

export interface CartLine {
  produit_id: string;
  code: string;
  nom: string;
  /** Unit price (MAD string) when added. */
  prix_mad: string;
  quantite: number;
  /** Orderable stock when added (soft cap in the UI; the API is the authority). */
  disponible: number;
}

export interface CartState {
  coopCode: string | null;
  coopNom: string | null;
  lines: CartLine[];
}

export const EMPTY_CART: CartState = { coopCode: null, coopNom: null, lines: [] };

export type AddResult = 'added' | 'other_coop';

/** Pure cart operations (unit-tested). */
export const cartOps = {
  add(
    cart: CartState,
    coop: { code: string; nom: string },
    item: Omit<CartLine, 'quantite'>,
    quantite: number,
  ): { cart: CartState; result: AddResult } {
    if (cart.coopCode && cart.coopCode !== coop.code && cart.lines.length > 0) {
      return { cart, result: 'other_coop' };
    }
    const existing = cart.lines.find((l) => l.produit_id === item.produit_id);
    const lines = existing
      ? cart.lines.map((l) =>
          l.produit_id === item.produit_id
            ? { ...l, ...item, quantite: Math.min(l.quantite + quantite, item.disponible) }
            : l,
        )
      : [...cart.lines, { ...item, quantite: Math.min(quantite, item.disponible) }];
    return { cart: { coopCode: coop.code, coopNom: coop.nom, lines }, result: 'added' };
  },

  setQuantity(cart: CartState, produitId: string, quantite: number): CartState {
    const lines = cart.lines
      .map((l) =>
        l.produit_id === produitId
          ? { ...l, quantite: Math.max(0, Math.min(Math.floor(quantite), l.disponible)) }
          : l,
      )
      .filter((l) => l.quantite > 0);
    return lines.length === 0 ? EMPTY_CART : { ...cart, lines };
  },

  total(cart: CartState): string {
    return sumMoney(cart.lines.map((l) => lineTotal(l.prix_mad, l.quantite)));
  },

  count(cart: CartState): number {
    return cart.lines.reduce((n, l) => n + l.quantite, 0);
  },
};

const KEY = 'agricoop.web.cart';

function load(): CartState {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY_CART;
    const parsed = JSON.parse(raw) as CartState;
    return Array.isArray(parsed.lines) ? parsed : EMPTY_CART;
  } catch {
    return EMPTY_CART;
  }
}

function save(cart: CartState): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cart));
  } catch {
    // Storage unavailable: the cart lives for this page only.
  }
}

interface CartContextValue {
  cart: CartState;
  /** `replace`: empty the cart first (switching cooperative). */
  add: (
    coop: { code: string; nom: string },
    item: Omit<CartLine, 'quantite'>,
    quantite: number,
    options?: { replace?: boolean },
  ) => AddResult;
  setQuantity: (produitId: string, quantite: number) => void;
  clear: () => void;
  total: string;
  count: number;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartState>(load);
  const value = useMemo<CartContextValue>(() => {
    const update = (next: CartState) => {
      setCart(next);
      save(next);
    };
    return {
      cart,
      add: (coop, item, quantite, options) => {
        const base = options?.replace ? EMPTY_CART : cart;
        const { cart: next, result } = cartOps.add(base, coop, item, quantite);
        if (result === 'added') update(next);
        return result;
      },
      setQuantity: (produitId, quantite) => update(cartOps.setQuantity(cart, produitId, quantite)),
      clear: () => update(EMPTY_CART),
      total: cartOps.total(cart),
      count: cartOps.count(cart),
    };
  }, [cart]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart outside CartProvider');
  return ctx;
}
