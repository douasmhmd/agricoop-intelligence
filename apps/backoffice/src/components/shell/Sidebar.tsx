import { BrandMark, cn, Kbd } from '@agricoop/ui';
import { spring } from '@agricoop/ui/motion';
import { Link, useRouterState } from '@tanstack/react-router';
import { PanelLeftClose, PanelLeftOpen, Search } from 'lucide-react';
import { LayoutGroup, motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useCommandPalette } from './CommandPalette';
import { useNavGroups } from './nav';

function isActive(pathname: string, to: string): boolean {
  return to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`);
}

/**
 * Sidebar content (desktop aside and mobile sheet). The active item's highlight slides between
 * items (Motion layoutId). Collapsed: icons only — labels stay as screen-reader text, so every link
 * keeps its accessible name.
 */
export function SidebarNav({
  collapsed = false,
  onNavigate,
  layoutGroup,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
  /** Distinct per instance, so the desktop and mobile highlights do not animate into each other. */
  layoutGroup: string;
}) {
  const { t } = useTranslation();
  const groups = useNavGroups();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <LayoutGroup id={layoutGroup}>
      <nav aria-label={t('nav.menu')} className="grid gap-5">
        {groups.map((group) => (
          <div key={group.key} className="grid gap-0.5">
            <p
              className={cn(
                'px-3 pb-1 text-[0.6875rem] font-semibold tracking-[0.12em] text-muted-foreground/80 uppercase transition-opacity duration-200',
                collapsed && 'sr-only',
              )}
            >
              {group.label}
            </p>
            {group.items.map((item) => {
              const active = isActive(pathname, item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={onNavigate}
                  title={collapsed ? item.label : undefined}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative flex h-9 items-center gap-3 rounded-lg px-3 text-sm transition-colors duration-150',
                    active
                      ? 'font-medium text-foreground'
                      : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground',
                    collapsed && 'justify-center px-0',
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="sidebar-active"
                      aria-hidden
                      className="absolute inset-0 rounded-lg border border-border/70 bg-card shadow-soft"
                      transition={spring.snappy}
                    >
                      <span className="absolute inset-y-2 start-0 w-0.5 rounded-full bg-gold" />
                    </motion.span>
                  )}
                  <item.icon className={cn('relative size-4 shrink-0', active && 'text-primary')} />
                  <span className={cn('relative truncate', collapsed && 'sr-only')}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </LayoutGroup>
  );
}

export function SidebarBrand({ collapsed }: { collapsed: boolean }) {
  const { t } = useTranslation();
  return (
    <Link
      to="/"
      className={cn(
        'flex h-10 items-center gap-2.5 rounded-lg px-2 text-primary',
        collapsed && 'justify-center px-0',
      )}
    >
      <BrandMark className="size-7 shrink-0" />
      <span
        className={cn(
          'min-w-0 truncate font-display text-base font-semibold text-foreground',
          collapsed && 'sr-only',
        )}
      >
        {t('app.name')}
      </span>
    </Link>
  );
}

/** "Search" entry opening the command palette, with its shortcut. */
export function PaletteButton({ collapsed }: { collapsed: boolean }) {
  const { t } = useTranslation();
  const palette = useCommandPalette();
  return (
    <button
      type="button"
      onClick={() => palette.setOpen(true)}
      title={collapsed ? t('palette.open') : undefined}
      className={cn(
        'flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg border border-border/80 bg-card px-3 text-sm text-muted-foreground shadow-soft transition-colors hover:border-foreground/20 hover:text-foreground',
        collapsed && 'justify-center px-0',
      )}
    >
      <Search className="size-4 shrink-0" aria-hidden />
      <span className={cn('flex-1 text-start', collapsed && 'sr-only')}>{t('palette.open')}</span>
      {!collapsed && (
        <span className="flex gap-0.5" aria-hidden>
          <Kbd>Ctrl</Kbd>
          <Kbd>K</Kbd>
        </span>
      )}
    </button>
  );
}

export function CollapseButton({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={collapsed ? t('nav.expand') : t('nav.collapse')}
      aria-expanded={!collapsed}
      title={collapsed ? t('nav.expand') : t('nav.collapse')}
      className={cn(
        'flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground',
        collapsed && 'justify-center px-0',
      )}
    >
      <Icon className="size-4 shrink-0 rtl:-scale-x-100" aria-hidden />
      <span className={cn(collapsed && 'sr-only')}>
        {collapsed ? t('nav.expand') : t('nav.collapse')}
      </span>
    </button>
  );
}
