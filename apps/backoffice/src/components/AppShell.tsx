import { Button, cn, Sheet, SheetContent, SheetTitle, useDirection } from '@agricoop/ui';
import { useRouterState } from '@tanstack/react-router';
import { Database, X } from 'lucide-react';
import { Direction } from 'radix-ui';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from '@/auth/session';
import { usePreferences } from '@/state/preferences';
import { CommandPaletteProvider } from './shell/CommandPalette';
import { CollapseButton, PaletteButton, SidebarBrand, SidebarNav } from './shell/Sidebar';
import { TopBar } from './shell/TopBar';

/** Routes that do not need a cooperative to be selected (saas_admin). */
const TENANTLESS = ['/admin', '/styleguide'];
const COLLAPSE_KEY = 'agricoop.backoffice.sidebarCollapsed';

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * "Pro dashboard" shell: collapsible sidebar (desktop; a sheet on smaller screens), glass top bar
 * with breadcrumbs, command palette (Ctrl/⌘ K), synthetic-data banner.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const session = useSession();
  const prefs = usePreferences();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const dir = useDirection();

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        window.localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1');
      } catch {
        // Not remembered: fine.
      }
      return !c;
    });
  };
  const needsCoop =
    session?.isAdmin && !prefs.adminCoopId && !TENANTLESS.some((p) => pathname.startsWith(p));

  return (
    // Radix menus, tabs and sheets follow the page direction (alignment, arrow keys).
    <Direction.Provider dir={dir}>
      <CommandPaletteProvider>
        <div className="flex min-h-dvh bg-background">
          {/* Desktop sidebar. Its width transitions (the one layout animation, asked for by the
            design: labels fade, icons stay put). */}
          <aside
            className={cn(
              'sticky top-0 hidden h-dvh shrink-0 flex-col gap-4 border-e border-sidebar-border bg-sidebar px-3 py-4 transition-[width] duration-300 ease-out-expo lg:flex',
              collapsed ? 'w-[4.25rem]' : 'w-64',
            )}
          >
            <SidebarBrand collapsed={collapsed} />
            <PaletteButton collapsed={collapsed} />
            <div className="-mx-1 flex-1 overflow-y-auto px-1">
              <SidebarNav collapsed={collapsed} layoutGroup="sidebar-desktop" />
            </div>
            <CollapseButton collapsed={collapsed} onToggle={toggleCollapsed} />
          </aside>

          {/* Below lg: the same navigation in a sheet (mounted only while open). */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetContent
              side="start"
              closeLabel={t('common.close')}
              className="gap-4 bg-sidebar px-3 py-4"
            >
              <SheetTitle className="sr-only">{t('nav.menu')}</SheetTitle>
              <SidebarBrand collapsed={false} />
              <PaletteButton collapsed={false} />
              <SidebarNav layoutGroup="sidebar-mobile" onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>

          <div className="flex min-w-0 flex-1 flex-col">
            <TopBar onOpenMenu={() => setMobileOpen(true)} />
            {prefs.showSynthetic && (
              <SyntheticBanner onHide={() => prefs.setShowSynthetic(false)} />
            )}
            <main className="mx-auto w-full max-w-[90rem] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
              {needsCoop ? (
                <p className="text-muted-foreground">{t('admin.chooseCoop')}</p>
              ) : (
                children
              )}
            </main>
          </div>
        </div>
      </CommandPaletteProvider>
    </Direction.Provider>
  );
}

function SyntheticBanner({ onHide }: { onHide: () => void }) {
  const { t } = useTranslation();
  return (
    <div
      role="note"
      className="flex items-center gap-3 border-b border-dashed border-muted-foreground/30 bg-[repeating-linear-gradient(135deg,color-mix(in_oklch,var(--muted-foreground)_7%,transparent)_0_6px,transparent_6px_12px)] px-4 py-1.5 text-xs text-muted-foreground sm:px-6 lg:px-8"
    >
      <Database className="size-3.5 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{t('synthetic.banner')}</span>
      <Button variant="ghost" size="xs" onClick={onHide} className="text-muted-foreground">
        <X aria-hidden /> {t('synthetic.hide')}
      </Button>
    </div>
  );
}
