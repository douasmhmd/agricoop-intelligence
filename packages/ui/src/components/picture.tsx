import { useState } from 'react';
import type * as React from 'react';
import { cn } from '../lib/cn';
import { BrandMark } from './brand';

/*
 * Image with a stable box (no layout shift), blur-up and a local fallback:
 * - the wrapper keeps its size from `className` (aspect-*, h-*, w-*), the image covers it;
 * - `placeholder` (a tiny blurred version) shows until the full image has loaded, then the image
 *   fades in (opacity only);
 * - if the image cannot load (offline, blocked, removed), a branded gradient replaces it.
 * Lazy by default; pass `priority` for the LCP image (hero).
 */
export function Picture({
  src,
  srcSet,
  sizes,
  placeholder,
  alt,
  priority = false,
  className,
  imgClassName,
  children,
}: {
  src: string;
  srcSet?: string;
  sizes?: string;
  placeholder?: string;
  alt: string;
  priority?: boolean;
  className?: string;
  imgClassName?: string;
  /** Overlays rendered above the image (gradients, captions). */
  children?: React.ReactNode;
}) {
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>('loading');
  return (
    <div
      data-slot="picture"
      data-state={state}
      className={cn('relative overflow-hidden bg-muted', className)}
    >
      {placeholder && state !== 'error' && (
        <img
          src={placeholder}
          alt=""
          aria-hidden
          decoding="async"
          className="absolute inset-0 size-full scale-110 object-cover blur-xl"
        />
      )}
      {state === 'error' ? (
        <div
          role="img"
          aria-label={alt}
          className="absolute inset-0 grid place-items-center bg-gradient-to-br from-olive-300 via-gold-200 to-sand-200 text-olive-800 dark:from-olive-800 dark:via-olive-900 dark:to-sand-900 dark:text-olive-300"
        >
          <div className="zellige absolute inset-0 text-olive-900/10 dark:text-gold/10" />
          <BrandMark className="relative size-12 opacity-80" />
        </div>
      ) : (
        <img
          src={src}
          srcSet={srcSet}
          sizes={sizes}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          onLoad={() => setState('loaded')}
          onError={() => setState('error')}
          className={cn(
            'absolute inset-0 size-full object-cover transition-opacity duration-700 ease-out-expo',
            state === 'loaded' ? 'opacity-100' : 'opacity-0',
            imgClassName,
          )}
        />
      )}
      {children}
    </div>
  );
}
