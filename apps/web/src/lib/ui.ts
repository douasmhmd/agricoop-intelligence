import type { CommandeStatut } from '@agricoop/shared';
import { useSyncExternalStore } from 'react';

/** Order status → badge variant (with a status dot). */
export const statutVariant: Record<
  CommandeStatut,
  'info' | 'warning' | 'default' | 'success' | 'secondary'
> = {
  creee: 'info',
  payee: 'warning',
  expediee: 'default',
  livree: 'success',
  annulee: 'secondary',
};

/** True while the media query matches (e.g. '(min-width: 768px)'); false on the server. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Whether the browser animates route changes natively (View Transitions API). */
export const supportsViewTransitions =
  typeof document !== 'undefined' && 'startViewTransition' in document;
