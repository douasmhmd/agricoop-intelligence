import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  useTheme,
} from '@agricoop/ui';
import { useNavigate } from '@tanstack/react-router';
import {
  Boxes,
  Building2,
  Database,
  Languages,
  LogOut,
  Monitor,
  Moon,
  Package,
  Sun,
} from 'lucide-react';
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from 'react-oidc-context';
import { signOut } from '@/auth/sign-out';
import { useCooperativesAdminList } from '@/api/generated/admin/admin';
import { ok } from '@/api/ok';
import { useSession } from '@/auth/session';
import { LANGUAGES, setLanguage } from '@/i18n';
import { usePreferences } from '@/state/preferences';
import { useNavGroups } from './nav';

interface PaletteContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const PaletteContext = createContext<PaletteContextValue>({
  open: false,
  setOpen: () => undefined,
});

export function useCommandPalette(): PaletteContextValue {
  return useContext(PaletteContext);
}

/** Command palette (Ctrl/⌘ K): go to any page, run actions, change preferences. */
export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const value = useMemo(() => ({ open, setOpen }), [open]);
  return (
    <PaletteContext.Provider value={value}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className="top-[18%] max-w-[calc(100%-2rem)] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl"
        >
          <PaletteTitles />
          {open && <Palette close={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </PaletteContext.Provider>
  );
}

function PaletteTitles() {
  const { t } = useTranslation();
  return (
    <>
      <DialogTitle className="sr-only">{t('palette.open')}</DialogTitle>
      <DialogDescription className="sr-only">{t('palette.placeholder')}</DialogDescription>
    </>
  );
}

function Palette({ close }: { close: () => void }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const groups = useNavGroups();
  const session = useSession();
  const auth = useAuth();
  const prefs = usePreferences();
  const { setPreference } = useTheme();
  const coops = ok(useCooperativesAdminList({ query: { enabled: !!session?.isAdmin } }).data) ?? [];

  const run = (action: () => void) => () => {
    close();
    action();
  };
  const otherLanguage = LANGUAGES.find((l) => l !== i18n.language) ?? 'fr';

  return (
    <Command loop>
      <CommandInput placeholder={t('palette.placeholder')} aria-label={t('palette.open')} />
      <CommandList>
        <CommandEmpty>{t('palette.empty')}</CommandEmpty>
        <CommandGroup heading={t('palette.navigation')}>
          {groups.flatMap((g) =>
            g.items.map((item) => (
              <CommandItem
                key={item.to}
                value={`${item.label} ${g.label}`}
                onSelect={run(() => void navigate({ to: item.to }))}
              >
                <item.icon />
                {item.label}
                <span className="ms-auto text-xs text-muted-foreground">{g.label}</span>
              </CommandItem>
            )),
          )}
        </CommandGroup>
        <CommandGroup heading={t('palette.actions')}>
          <CommandItem
            value={t('produits.new')}
            onSelect={run(() => void navigate({ to: '/produits', search: { nouveau: 1 } }))}
          >
            <Package />
            {t('produits.new')}
          </CommandItem>
          <CommandItem
            value={t('lots.new')}
            onSelect={run(() => void navigate({ to: '/lots', search: { nouveau: 1 } }))}
          >
            <Boxes />
            {t('lots.new')}
          </CommandItem>
        </CommandGroup>
        {session?.isAdmin && coops.length > 0 && (
          <CommandGroup heading={t('palette.cooperatives')}>
            {coops.map((c) => (
              <CommandItem
                key={c.coop_id}
                value={`${c.code} ${c.nom}`}
                onSelect={run(() => prefs.setAdminCoopId(c.coop_id))}
              >
                <Building2 />
                {c.nom}
                <CommandShortcut>{c.code}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        <CommandGroup heading={t('palette.preferences')}>
          <CommandItem
            value={prefs.showSynthetic ? t('palette.hideSynthetic') : t('palette.showSynthetic')}
            onSelect={run(() => prefs.setShowSynthetic(!prefs.showSynthetic))}
          >
            <Database />
            {prefs.showSynthetic ? t('palette.hideSynthetic') : t('palette.showSynthetic')}
          </CommandItem>
          {(
            [
              ['light', Sun],
              ['dark', Moon],
              ['system', Monitor],
            ] as const
          ).map(([theme, Icon]) => (
            <CommandItem
              key={theme}
              value={t('palette.theme', { theme: t(`theme.${theme}`) })}
              onSelect={run(() => setPreference(theme))}
            >
              <Icon />
              {t('palette.theme', { theme: t(`theme.${theme}`) })}
            </CommandItem>
          ))}
          <CommandItem
            value={t('palette.language', { language: t(`language.${otherLanguage}`) })}
            onSelect={run(() => void setLanguage(otherLanguage))}
          >
            <Languages />
            {t('palette.language', { language: t(`language.${otherLanguage}`) })}
          </CommandItem>
          <CommandItem value={t('auth.signOut')} onSelect={run(() => signOut(auth))}>
            <LogOut className="rtl:rotate-180" />
            {t('auth.signOut')}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
