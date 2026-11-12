import { useSyncExternalStore } from 'react';
import type { Direction } from '../motion';

/*
 * The apps set <html dir> from the language (i18n). Components read it here instead of importing
 * i18next, so the design system stays independent of the apps' translation setup.
 */
function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['dir'] });
  return () => observer.disconnect();
}

function read(): Direction {
  return document.documentElement.dir === 'rtl' ? 'rtl' : 'ltr';
}

/** Current document direction, re-rendering when <html dir> changes. */
export function useDirection(): Direction {
  return useSyncExternalStore(subscribe, read, () => 'ltr');
}
