import { Link, useRouterState } from '@tanstack/react-router';
import {
  Boxes,
  Building2,
  ChartLine,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  QrCode,
  ShoppingCart,
  TriangleAlert,
} from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from 'react-oidc-context';
import { useCooperativesAdminList } from '@/api/generated/admin/admin';
import { ok } from '@/api/ok';
import { useSession } from '@/auth/session';
import { NativeSelect } from '@/components/common';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { usePreferences } from '@/state/preferences';

interface NavItem {
  to: string;
  label: string;
  icon: typeof Package;
  adminOnly?: boolean;
}

/** Routes that do not need a cooperative to be selected (saas_admin). */
const TENANTLESS = ['/admin'];

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const auth = useAuth();
  const session = useSession();
  const prefs = usePreferences();
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const nav: NavItem[] = [
    { to: '/', label: t('nav.dashboard'), icon: LayoutDashboard },
    { to: '/produits', label: t('nav.produits'), icon: Package },
    { to: '/lots', label: t('nav.lots'), icon: Boxes },
    { to: '/stock/alertes', label: t('nav.alertes'), icon: TriangleAlert },
    { to: '/commandes', label: t('nav.commandes'), icon: ShoppingCart },
    { to: '/qr', label: t('nav.qr'), icon: QrCode },
    { to: '/previsions', label: t('nav.previsions'), icon: ChartLine },
    { to: '/admin/cooperatives', label: t('nav.admin'), icon: Building2, adminOnly: true },
  ];
  const needsCoop =
    session?.isAdmin && !prefs.adminCoopId && !TENANTLESS.some((p) => pathname.startsWith(p));

  return (
    <div className="flex min-h-dvh">
      <aside
        className={cn(
          'fixed inset-y-0 start-0 z-30 w-64 border-e bg-card p-4 transition-transform lg:static lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full',
        )}
      >
        <div className="mb-6 px-2 text-lg font-semibold text-primary">{t('app.name')}</div>
        <nav className="grid gap-1">
          {nav
            .filter((item) => !item.adminOnly || session?.isAdmin)
            .map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                activeOptions={{ exact: item.to === '/' }}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                activeProps={{ className: 'bg-accent font-medium text-accent-foreground' }}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            ))}
        </nav>
      </aside>
      {open && (
        <div className="fixed inset-0 z-20 bg-black/30 lg:hidden" onClick={() => setOpen(false)} />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b bg-background/95 px-4 py-2 backdrop-blur">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setOpen(true)}
            aria-label={t('nav.menu')}
          >
            <Menu className="size-5" />
          </Button>
          {session?.isAdmin && <CoopSwitcher />}
          <label className="ms-auto flex items-center gap-2 text-sm">
            <Switch
              checked={prefs.showSynthetic}
              onCheckedChange={prefs.setShowSynthetic}
              aria-label={t('synthetic.toggle')}
            />
            <span className="hidden sm:inline">{t('synthetic.toggle')}</span>
          </label>
          <LanguageSwitcher />
          <span className="hidden text-sm text-muted-foreground md:inline">{session?.name}</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => void auth.signoutRedirect()}
            aria-label={t('auth.signOut')}
          >
            <LogOut className="size-4 rtl:rotate-180" />
          </Button>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6">
          {needsCoop ? <p className="text-muted-foreground">{t('admin.chooseCoop')}</p> : children}
        </main>
      </div>
    </div>
  );
}

/** saas_admin: pick the cooperative to act on (sent as X-Coop-Id, audited by the API). */
function CoopSwitcher() {
  const { t } = useTranslation();
  const prefs = usePreferences();
  const coops = ok(useCooperativesAdminList().data) ?? [];
  return (
    <NativeSelect
      aria-label={t('admin.coop')}
      value={prefs.adminCoopId ?? ''}
      onChange={(e) => prefs.setAdminCoopId(e.target.value || undefined)}
      className="max-w-56"
    >
      <option value="">{t('admin.chooseCoopShort')}</option>
      {coops.map((c) => (
        <option key={c.coop_id} value={c.coop_id}>{`${c.code} — ${c.nom}`}</option>
      ))}
    </NativeSelect>
  );
}
