import {
  BrandMark,
  Button,
  cn,
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
  ThemeToggle,
} from '@agricoop/ui';
import { ease, fadeUp, stagger } from '@agricoop/ui/motion';
import { Link, useRouterState } from '@tanstack/react-router';
import { Menu, ShoppingBag, UserRound } from 'lucide-react';
import { motion, useAnimate, useMotionValueEvent, useReducedMotion, useScroll } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from 'react-oidc-context';
import { useCart } from '@/cart/cart';
import { preloadCartDrawer, useCartDrawer } from '@/cart/drawer-context';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

/** Home sections reachable from the navigation (ids set on the home page). */
const SECTIONS = [
  { hash: 'produits', key: 'nav.products' },
  { hash: 'cooperatives', key: 'nav.cooperatives' },
  { hash: 'histoire', key: 'nav.story' },
  { hash: 'authenticite', key: 'nav.authenticity' },
] as const;

/**
 * Fixed header. On the home page it starts transparent over the hero and turns into a frosted
 * glass bar once the page scrolls; elsewhere it is always the glass bar.
 */
export function SiteHeader() {
  const { t } = useTranslation();
  const isHome = useRouterState({ select: (s) => s.location.pathname === '/' });
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y > 24));
  const solid = !isHome || scrolled;

  return (
    <header
      data-solid={solid || undefined}
      className={cn(
        'fixed inset-x-0 top-0 z-40 border-b transition-[background-color,border-color,box-shadow,backdrop-filter] duration-500 ease-out-expo',
        solid ? 'glass border-border/60 shadow-soft' : 'border-transparent bg-transparent',
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:px-6 lg:h-18 lg:px-8">
        <Link
          to="/"
          className="me-auto flex items-center gap-2 rounded-md text-primary"
          aria-label={t('app.name')}
        >
          <BrandMark className="size-8" />
          <span className="font-display text-xl font-semibold tracking-tight text-foreground">
            {t('app.name')}
          </span>
        </Link>

        <nav aria-label={t('nav.main')} className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {SECTIONS.map((s) => (
              <li key={s.hash}>
                <Link
                  to="/"
                  hash={s.hash}
                  className="group relative rounded-md px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:text-foreground"
                >
                  {t(s.key)}
                  <span
                    aria-hidden
                    className="absolute inset-x-3 bottom-1 h-px origin-left scale-x-0 bg-gold transition-transform duration-300 ease-out-expo group-hover:scale-x-100 rtl:origin-right"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ms-2 hidden items-center gap-2 lg:flex">
          <LanguageSwitcher />
        </div>
        <AccountButton className="hidden sm:inline-flex" />
        <CartButton />
        <MobileMenu />
      </div>
    </header>
  );
}

function AccountButton({ className }: { className?: string }) {
  const { t } = useTranslation();
  const auth = useAuth();
  if (auth.isAuthenticated) {
    return (
      <Button
        asChild
        variant="ghost"
        size="icon"
        shape="pill"
        className={className}
        aria-label={t('nav.account')}
      >
        <Link to="/compte">
          <UserRound className="size-5" />
        </Link>
      </Button>
    );
  }
  return (
    <Button
      variant="ghost"
      size="sm"
      shape="pill"
      className={className}
      onClick={() =>
        void auth.signinRedirect({
          state: { returnTo: `${window.location.pathname}${window.location.search}` },
        })
      }
    >
      {t('auth.signIn')}
    </Button>
  );
}

/** Cart link; its badge bounces each time the item count goes up. */
function CartButton() {
  const { t } = useTranslation();
  const { count } = useCart();
  const drawer = useCartDrawer();
  const [scope, animate] = useAnimate<HTMLSpanElement>();
  const previous = useRef(count);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (count > previous.current && scope.current && !reduced) {
      void animate(
        scope.current,
        { scale: [1, 1.45, 0.88, 1.08, 1] },
        { duration: 0.55, ease: ease.out },
      );
    }
    previous.current = count;
  }, [count, animate, scope, reduced]);

  return (
    <Button
      asChild
      variant="ghost"
      size="icon-lg"
      shape="pill"
      className="relative"
      aria-label={t('nav.cart', { count })}
    >
      <Link
        to="/panier"
        data-cart-target
        onPointerEnter={preloadCartDrawer}
        onFocus={preloadCartDrawer}
        onClick={(e) => {
          // A plain click opens the drawer; new-tab / modified clicks keep the /panier page.
          if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
          e.preventDefault();
          drawer.setOpen(true);
        }}
      >
        <ShoppingBag className="size-5" />
        <span
          ref={scope}
          aria-hidden
          className={cn(
            'absolute -end-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-gold px-1 text-[0.6875rem] font-bold text-gold-foreground tabular-nums shadow-soft transition-opacity',
            count === 0 && 'opacity-0',
          )}
        >
          {count}
        </span>
      </Link>
    </Button>
  );
}

function MobileMenu() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon-lg"
          shape="pill"
          className="lg:hidden"
          aria-label={t('nav.menu')}
        >
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="top" closeLabel={t('common.close')} className="grain gap-8 pt-6">
        <SheetTitle className="flex items-center gap-2 text-primary">
          <BrandMark className="size-7" />
          <span className="text-foreground">{t('app.name')}</span>
        </SheetTitle>
        <nav aria-label={t('nav.main')}>
          <motion.ul
            variants={stagger(0.06, 0.08)}
            initial="hidden"
            animate={open ? 'visible' : 'hidden'}
            className="space-y-1"
          >
            {SECTIONS.map((s) => (
              <motion.li key={s.hash} variants={fadeUp} custom={10}>
                <SheetClose asChild>
                  <Link
                    to="/"
                    hash={s.hash}
                    className="flex items-center justify-between rounded-lg px-2 py-3 font-display text-2xl font-semibold transition-colors hover:bg-accent"
                  >
                    {t(s.key)}
                    <span aria-hidden className="text-gold">
                      ✦
                    </span>
                  </Link>
                </SheetClose>
              </motion.li>
            ))}
          </motion.ul>
        </nav>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
          <LanguageSwitcher />
          <ThemeToggle
            labels={{
              group: t('theme.group'),
              light: t('theme.light'),
              dark: t('theme.dark'),
              system: t('theme.system'),
            }}
          />
          <AccountButton className="w-full sm:hidden" />
        </div>
      </SheetContent>
    </Sheet>
  );
}
