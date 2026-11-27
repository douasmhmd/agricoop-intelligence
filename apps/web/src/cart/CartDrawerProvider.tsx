import { lazy, type ReactNode, Suspense, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { DrawerContext } from './drawer-context';

const CartDrawer = lazy(() => import('./CartDrawer'));

export function CartDrawerProvider({ children }: { children: ReactNode }) {
  const [open, setOpenState] = useState(false);
  // Mounted on first open, then kept (its close animation and state survive).
  const [mounted, setMounted] = useState(false);
  const value = useMemo(
    () => ({
      open,
      setOpen: (next: boolean) => {
        if (next) {
          // The "added to cart" toast would sit over the drawer's checkout button on phones.
          toast.dismiss();
          setMounted(true);
        }
        setOpenState(next);
      },
    }),
    [open],
  );
  return (
    <DrawerContext.Provider value={value}>
      {children}
      {mounted && (
        <Suspense fallback={null}>
          <CartDrawer />
        </Suspense>
      )}
    </DrawerContext.Provider>
  );
}
