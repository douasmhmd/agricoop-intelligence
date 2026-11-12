import 'lenis/dist/lenis.css';
import Lenis from 'lenis';
import { useReducedMotion } from 'motion/react';
import { useEffect } from 'react';

/**
 * Lenis smooth scrolling for the storefront (wheel and anchors; touch keeps native scrolling).
 * Off when the visitor prefers reduced motion. Paused while a Radix dialog/sheet locks the page
 * (react-remove-scroll marks <body data-scroll-locked>), so overlays scroll normally.
 */
export function SmoothScroll() {
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) return;
    const lenis = new Lenis({ autoRaf: true, anchors: { offset: -88 }, lerp: 0.11 });
    const sync = () =>
      document.body.hasAttribute('data-scroll-locked') ? lenis.stop() : lenis.start();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-scroll-locked'] });
    return () => {
      observer.disconnect();
      lenis.destroy();
    };
  }, [reduced]);
  return null;
}
