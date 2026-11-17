import { useReducedMotion } from 'motion/react';
import { useEffect } from 'react';

/**
 * Lenis smooth scrolling for the storefront (wheel and anchors; touch keeps native scrolling).
 * Off when the visitor prefers reduced motion. Paused while a Radix dialog/sheet locks the page
 * (react-remove-scroll marks <body data-scroll-locked>), so overlays scroll normally.
 * Loaded once the browser is idle: it is an enhancement, not needed for the first paint.
 */
export function SmoothScroll() {
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) return;
    let cancelled = false;
    let cleanup = () => undefined as void;
    const start = () => {
      void Promise.all([import('lenis'), import('lenis/dist/lenis.css')]).then(
        ([{ default: Lenis }]) => {
          if (cancelled) return;
          const lenis = new Lenis({ autoRaf: true, anchors: { offset: -88 }, lerp: 0.11 });
          const sync = () =>
            document.body.hasAttribute('data-scroll-locked') ? lenis.stop() : lenis.start();
          const observer = new MutationObserver(sync);
          observer.observe(document.body, {
            attributes: true,
            attributeFilter: ['data-scroll-locked'],
          });
          cleanup = () => {
            observer.disconnect();
            lenis.destroy();
          };
        },
      );
    };
    // Safari has no requestIdleCallback: a short timeout instead.
    const hasIdle = typeof window.requestIdleCallback === 'function';
    const handle = hasIdle
      ? window.requestIdleCallback(start, { timeout: 3000 })
      : Number(setTimeout(start, 1500));
    return () => {
      cancelled = true;
      if (hasIdle) window.cancelIdleCallback(handle);
      else clearTimeout(handle);
      cleanup();
    };
  }, [reduced]);
  return null;
}
