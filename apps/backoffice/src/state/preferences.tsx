import { createContext, type ReactNode, useContext, useMemo, useState } from 'react';

/*
 * Per-user back-office preferences, remembered in localStorage (best effort):
 *  - showSynthetic: global show / hide of synthetic rows (default: show, with a badge);
 *  - adminCoopId: the cooperative a saas_admin is acting on (sent as X-Coop-Id, audited).
 */
export interface Preferences {
  showSynthetic: boolean;
  setShowSynthetic: (value: boolean) => void;
  adminCoopId: string | undefined;
  setAdminCoopId: (value: string | undefined) => void;
  /** `include` / `exclude` for the API's `synthetic` query parameter. */
  synthetic: 'include' | 'exclude';
}

const KEY_SYNTHETIC = 'agricoop.backoffice.showSynthetic';
const KEY_COOP = 'agricoop.backoffice.adminCoopId';

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | undefined): void {
  try {
    if (value === undefined) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Storage unavailable: the preference only lasts for this page.
  }
}

const PreferencesContext = createContext<Preferences | undefined>(undefined);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [showSynthetic, setShowSyntheticState] = useState(() => read(KEY_SYNTHETIC) !== 'false');
  const [adminCoopId, setAdminCoopIdState] = useState<string | undefined>(
    () => read(KEY_COOP) ?? undefined,
  );
  const value = useMemo<Preferences>(
    () => ({
      showSynthetic,
      setShowSynthetic: (v) => {
        setShowSyntheticState(v);
        write(KEY_SYNTHETIC, String(v));
      },
      adminCoopId,
      setAdminCoopId: (v) => {
        setAdminCoopIdState(v);
        write(KEY_COOP, v);
      },
      synthetic: showSynthetic ? 'include' : 'exclude',
    }),
    [showSynthetic, adminCoopId],
  );
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): Preferences {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences outside PreferencesProvider');
  return ctx;
}
