import type * as React from 'react';
import { cn } from '../lib/cn';

/** Shared by Input, Textarea and native selects so every field looks the same. */
export const fieldClasses = [
  'w-full min-w-0 rounded-md border border-input bg-card px-3 text-base shadow-soft md:text-sm',
  'transition-[border-color,box-shadow,background-color] duration-200 ease-out-expo',
  'placeholder:text-muted-foreground/80 selection:bg-gold/30',
  'hover:border-foreground/25',
  'focus-visible:border-ring focus-visible:shadow-[0_0_0_4px_color-mix(in_oklch,var(--ring)_22%,transparent)] focus-visible:outline-none',
  'disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60',
  'aria-invalid:border-destructive aria-invalid:focus-visible:shadow-[0_0_0_4px_color-mix(in_oklch,var(--destructive)_18%,transparent)]',
].join(' ');

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        fieldClasses,
        'h-10 py-2',
        'file:me-3 file:inline-flex file:h-7 file:rounded-sm file:border-0 file:bg-secondary file:px-2 file:text-sm file:font-medium file:text-foreground',
        className,
      )}
      {...props}
    />
  );
}

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        fieldClasses,
        'field-sizing-content min-h-24 py-2.5 leading-relaxed',
        className,
      )}
      {...props}
    />
  );
}

export { Input, Textarea };
