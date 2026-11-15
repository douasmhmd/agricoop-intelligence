import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Kbd,
  Switch,
  ThemeToggle,
} from '@agricoop/ui';
import { Link, useRouterState } from '@tanstack/react-router';
import { ChevronDown, ChevronRight, LogOut, Menu, Search } from 'lucide-react';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from 'react-oidc-context';
import { useCooperativesAdminList } from '@/api/generated/admin/admin';
import { ok } from '@/api/ok';
import { useSession } from '@/auth/session';
import { NativeSelect } from '@/components/common';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { usePreferences } from '@/state/preferences';
import { useCommandPalette } from './CommandPalette';
import { useBreadcrumbs } from './nav';

export function TopBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { t } = useTranslation();
  const session = useSession();
  const prefs = usePreferences();
  const palette = useCommandPalette();

  return (
    <header className="glass sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border/70 px-3 sm:px-5">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onOpenMenu}
        aria-label={t('nav.menu')}
      >
        <Menu className="size-5" />
      </Button>
      <Breadcrumbs />

      <div className="ms-auto flex items-center gap-1.5 sm:gap-2.5">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={() => palette.setOpen(true)}
          aria-label={t('palette.open')}
        >
          <Search className="size-4" />
        </Button>
        {session?.isAdmin && <CoopSwitcher />}
        <label className="flex cursor-pointer items-center gap-2 rounded-full px-2 text-sm text-muted-foreground hover:text-foreground">
          <Switch
            size="sm"
            checked={prefs.showSynthetic}
            onCheckedChange={prefs.setShowSynthetic}
            aria-label={t('synthetic.toggle')}
          />
          <span className="hidden xl:inline">{t('synthetic.toggle')}</span>
        </label>
        <ThemeToggle
          className="hidden md:inline-flex"
          labels={{
            group: t('theme.group'),
            light: t('theme.light'),
            dark: t('theme.dark'),
            system: t('theme.system'),
          }}
        />
        <LanguageSwitcher className="hidden sm:inline-flex" />
        <UserMenu />
      </div>
    </header>
  );
}

function Breadcrumbs() {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const crumbs = useBreadcrumbs(pathname);
  return (
    <nav aria-label={t('nav.breadcrumb')} className="min-w-0">
      <ol className="flex items-center gap-1.5 text-sm">
        {crumbs.map((c, i) => (
          <Fragment key={`${c.label}-${i}`}>
            {i > 0 && (
              <ChevronRight
                className="size-3.5 shrink-0 text-muted-foreground/60 rtl:rotate-180"
                aria-hidden
              />
            )}
            <li className="min-w-0 truncate max-sm:[&:not(:last-child)]:hidden">
              {c.to ? (
                <Link
                  to={c.to}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  {c.label}
                </Link>
              ) : (
                <span aria-current="page" className="font-medium text-foreground">
                  {c.label}
                </span>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}

function UserMenu() {
  const { t, i18n } = useTranslation();
  const auth = useAuth();
  const session = useSession();
  const name = session?.name ?? '';
  return (
    <DropdownMenu dir={i18n.dir()}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="gap-2 rounded-full ps-1 pe-2"
          aria-label={t('user.menu')}
        >
          <span
            aria-hidden
            className="grid size-7 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
          >
            {name.charAt(0).toUpperCase() || '·'}
          </span>
          <span className="hidden max-w-32 truncate text-sm md:inline">{name}</span>
          <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <span className="block text-sm font-medium text-foreground">{name}</span>
          <span className="block text-xs text-muted-foreground">
            {session?.isAdmin ? t('user.role.admin') : t('user.role.manager')}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="flex items-center justify-between px-2 py-1.5 sm:hidden">
          <LanguageSwitcher />
        </div>
        <DropdownMenuItem onSelect={() => void auth.signoutRedirect()}>
          <LogOut className="rtl:rotate-180" /> {t('auth.signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
      className="h-8 max-w-48 rounded-full text-xs sm:max-w-56"
    >
      <option value="">{t('admin.chooseCoopShort')}</option>
      {coops.map((c) => (
        <option key={c.coop_id} value={c.coop_id}>{`${c.code} — ${c.nom}`}</option>
      ))}
    </NativeSelect>
  );
}

/** Kbd hint reused in empty states / tips. */
export function PaletteHint() {
  return (
    <span className="inline-flex gap-0.5" aria-hidden>
      <Kbd>Ctrl</Kbd>
      <Kbd>K</Kbd>
    </span>
  );
}
