import { useEffect, useState } from 'react';

/*
 * The production build pre-renders the header and the home hero into index.html
 * (scripts/prerender.mjs), so phones see the page before the JavaScript arrives. theme-init.js
 * shows that shell only on "/" in French (it sets html.prerendered before the first paint).
 *
 * When the app boots over the shell, the hero must not replay its intro (the content would vanish
 * and come back), and main.tsx waits for the home route before its first render so React replaces
 * the shell with the same content in one go. main.tsx imports this module first, while the shell
 * is still in the document. During the pre-render itself (no document), intros are skipped too, so
 * the HTML holds the final state.
 */
export const bootedOverShell =
  typeof document === 'undefined' || document.querySelector('html.prerendered #prerender') !== null;

let pending = bootedOverShell;

/** True for the first home render after booting over the shell; false on later visits. */
export function useSkipIntro(): boolean {
  const [skip] = useState(() => pending);
  useEffect(() => {
    pending = false;
  }, []);
  return skip;
}
