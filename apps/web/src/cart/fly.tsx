import { ease } from '@agricoop/ui/motion';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

/*
 * "Add to cart" flight: a round thumbnail flies from the product image to the header cart icon
 * (`[data-cart-target]`) along an arc. Transform and opacity only; skipped with reduced motion.
 */

interface Flight {
  id: number;
  src: string;
  from: DOMRect;
  dx: number;
  dy: number;
}

const FlyContext = createContext<(from: Element | null, src: string) => void>(() => undefined);

const SIZE = 56;

export function FlyToCartProvider({ children }: { children: ReactNode }) {
  const [flights, setFlights] = useState<Flight[]>([]);
  const next = useRef(0);
  const reduced = useReducedMotion();

  const fly = useCallback(
    (from: Element | null, src: string) => {
      const target = document.querySelector('[data-cart-target]');
      if (reduced || !from || !target) return;
      const a = from.getBoundingClientRect();
      const b = target.getBoundingClientRect();
      const startX = a.left + a.width / 2 - SIZE / 2;
      const startY = a.top + a.height / 2 - SIZE / 2;
      const dx = b.left + b.width / 2 - SIZE / 2 - startX;
      const dy = b.top + b.height / 2 - SIZE / 2 - startY;
      next.current += 1;
      const flight = {
        id: next.current,
        src,
        from: new DOMRect(startX, startY, SIZE, SIZE),
        dx,
        dy,
      };
      setFlights((list) => [...list, flight]);
    },
    [reduced],
  );

  const value = useMemo(() => fly, [fly]);

  return (
    <FlyContext.Provider value={value}>
      {children}
      {createPortal(
        <AnimatePresence>
          {flights.map((f) => (
            <motion.img
              key={f.id}
              src={f.src}
              alt=""
              aria-hidden
              className="pointer-events-none fixed z-[60] rounded-full object-cover shadow-float ring-2 ring-gold"
              style={{ left: f.from.x, top: f.from.y, width: SIZE, height: SIZE }}
              initial={{ x: 0, y: 0, scale: 1.4, opacity: 0 }}
              animate={{
                // Arc: rise first, then dive into the cart.
                x: [0, f.dx * 0.55, f.dx],
                y: [0, Math.min(-80, f.dy * 0.4 - 80), f.dy],
                scale: [1.4, 1, 0.3],
                opacity: [0, 1, 0.9],
              }}
              transition={{ duration: 0.75, ease: ease.inOut, times: [0, 0.45, 1] }}
              onAnimationComplete={() => setFlights((list) => list.filter((x) => x.id !== f.id))}
            />
          ))}
        </AnimatePresence>,
        document.body,
      )}
    </FlyContext.Provider>
  );
}

/** `fly(element, imageUrl)`: animate a thumbnail from `element` to the header cart. */
export function useFlyToCart() {
  return useContext(FlyContext);
}
