import { createContext, useContext } from 'react';

/*
 * Cart drawer state, kept apart from the drawer UI (cart/CartDrawer.tsx, Vaul + sheet + lines),
 * which is loaded the first time the drawer opens: it is not needed for the first paint.
 */

export interface DrawerContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const DrawerContext = createContext<DrawerContextValue>({
  open: false,
  setOpen: () => undefined,
});

export function useCartDrawer(): DrawerContextValue {
  return useContext(DrawerContext);
}

/** Starts downloading the drawer UI (cart button hover / focus) so it opens without a wait. */
export function preloadCartDrawer(): void {
  void import('./CartDrawer');
}
