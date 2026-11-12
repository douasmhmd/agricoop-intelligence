import { lineTotal } from '@agricoop/shared';
import {
  Button,
  Picture,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@agricoop/ui';
import { spring } from '@agricoop/ui/motion';
import { Link, useRouter } from '@tanstack/react-router';
import { ShoppingBag, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Drawer } from 'vaul';
import { useCart, type CartLine } from '@/cart/cart';
import { EmptyState, QuantityStepper } from '@/components/common';
import { Price } from '@/components/Price';
import { photo, productPhoto } from '@/lib/images';
import { useMediaQuery } from '@/lib/ui';

/*
 * Cart drawer: a side sheet on desktop, a Vaul bottom sheet on phones (drag to dismiss). The full
 * /panier page stays for direct visits and links opened in a new tab.
 */

interface DrawerContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const DrawerContext = createContext<DrawerContextValue>({ open: false, setOpen: () => undefined });

export function useCartDrawer(): DrawerContextValue {
  return useContext(DrawerContext);
}

export function CartDrawerProvider({ children }: { children: ReactNode }) {
  const [open, setOpenState] = useState(false);
  const value = useMemo(
    () => ({
      open,
      setOpen: (next: boolean) => {
        // The "added to cart" toast would sit over the drawer's checkout button on phones.
        if (next) toast.dismiss();
        setOpenState(next);
      },
    }),
    [open],
  );
  return (
    <DrawerContext.Provider value={value}>
      {children}
      <CartDrawer />
    </DrawerContext.Provider>
  );
}

function CartDrawer() {
  const { t } = useTranslation();
  const { open, setOpen } = useCartDrawer();
  const desktop = useMediaQuery('(min-width: 768px)');
  // Any navigation (checkout, product link, back button) closes the drawer.
  const router = useRouter();
  useEffect(() => router.subscribe('onBeforeNavigate', () => setOpen(false)), [router, setOpen]);

  if (desktop) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="end"
          closeLabel={t('common.close')}
          className="gap-0 p-0"
          data-lenis-prevent
        >
          <CartPanel
            Title={SheetTitle}
            Description={SheetDescription}
            Footer={SheetFooter}
            Header={SheetHeader}
          />
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Drawer.Root open={open} onOpenChange={setOpen}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px] dark:bg-black/60" />
        <Drawer.Content
          data-lenis-prevent
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col rounded-t-3xl border-t bg-popover text-popover-foreground shadow-float outline-none"
        >
          <div
            aria-hidden
            className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-muted-foreground/30"
          />
          <CartPanel
            Title={Drawer.Title}
            Description={Drawer.Description}
            Header="div"
            Footer="div"
          />
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

type Slot = React.ElementType<{ className?: string; children?: ReactNode }>;

function CartPanel({
  Title,
  Description,
  Header,
  Footer,
}: {
  Title: Slot;
  Description: Slot;
  Header: Slot;
  Footer: Slot;
}) {
  const { t } = useTranslation();
  const { cart, setQuantity, total } = useCart();
  const { setOpen } = useCartDrawer();
  const empty = cart.lines.length === 0 || !cart.coopCode;

  return (
    <>
      <Header className="border-b px-6 pt-6 pb-4">
        <Title className="font-display text-2xl font-semibold">{t('cart.title')}</Title>
        <Description className="text-sm text-muted-foreground">
          {empty ? t('cart.empty') : t('cart.from', { coop: cart.coopNom ?? cart.coopCode })}
        </Description>
      </Header>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {empty ? (
          <EmptyState icon={<ShoppingBag className="size-7" aria-hidden />} className="mt-4">
            <Button variant="link" onClick={() => setOpen(false)}>
              {t('cart.continue')}
            </Button>
          </EmptyState>
        ) : (
          <CartLines lines={cart.lines} onQuantity={setQuantity} compact />
        )}
      </div>

      {!empty && cart.coopCode && (
        <Footer className="mt-0 gap-3 border-t bg-card/60 px-6 py-5">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">{t('cart.total')}</span>
            <Price value={total} className="font-display text-2xl font-semibold" />
          </div>
          <p className="text-xs text-muted-foreground">{t('cart.priceNotice')}</p>
          <Button asChild size="xl" shape="pill" variant="gold">
            <Link to="/coops/$code/commander" params={{ code: cart.coopCode }}>
              {t('cart.checkout')}
            </Link>
          </Button>
          <Button variant="ghost" shape="pill" onClick={() => setOpen(false)}>
            {t('cart.continue')}
          </Button>
        </Footer>
      )}
    </>
  );
}

/** Cart lines with animated add / remove (shared by the drawer and the /panier page). */
export function CartLines({
  lines,
  onQuantity,
  compact = false,
}: {
  lines: CartLine[];
  onQuantity: (produitId: string, quantite: number) => void;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <ul className="grid gap-3">
      <AnimatePresence initial={false}>
        {lines.map((l) => (
          <motion.li
            key={l.produit_id}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={spring.soft}
            className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-soft"
          >
            <Picture
              {...photo(productPhoto(l.categorie ?? '', l.famille ?? 'alimentaire'), '80px', 400)}
              alt=""
              className="size-16 shrink-0 rounded-lg sm:size-18"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{l.nom}</p>
              <p className="text-sm text-muted-foreground tabular-nums">
                <Price value={l.prix_mad} /> × {l.quantite}
              </p>
              {compact && (
                <div className="mt-2 flex items-center justify-between gap-2">
                  <QuantityStepper
                    value={l.quantite}
                    max={l.disponible}
                    onChange={(q) => onQuantity(l.produit_id, q)}
                    label={t('cart.quantity')}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    shape="pill"
                    onClick={() => onQuantity(l.produit_id, 0)}
                    aria-label={t('cart.remove')}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              )}
            </div>
            {!compact && (
              <>
                <QuantityStepper
                  value={l.quantite}
                  max={l.disponible}
                  onChange={(q) => onQuantity(l.produit_id, q)}
                  label={t('cart.quantity')}
                />
                <Price
                  value={lineTotal(l.prix_mad, l.quantite)}
                  className="hidden w-28 text-end font-semibold sm:inline"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  shape="pill"
                  onClick={() => onQuantity(l.produit_id, 0)}
                  aria-label={t('cart.remove')}
                >
                  <Trash2 className="size-4" />
                </Button>
              </>
            )}
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
