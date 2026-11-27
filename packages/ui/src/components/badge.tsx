import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import type * as React from 'react';
import { cn } from '../lib/cn';

/*
 * Tinted badges: soft background, coloured text and border. `dot` adds a status dot in the text
 * colour (order statuses, QR statuses). `synthetic` is the striped badge for generated data.
 */
const badgeVariants = cva(
  [
    'inline-flex w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-full border px-2.5 py-0.5',
    'text-xs leading-5 font-medium whitespace-nowrap transition-colors',
    '[&>svg]:pointer-events-none [&>svg]:size-3',
  ].join(' '),
  {
    variants: {
      variant: {
        default: 'border-primary/15 bg-primary/10 text-primary dark:bg-primary/15',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'border-border bg-transparent text-foreground',
        gold: 'border-gold/40 bg-gold/15 text-gold-foreground dark:text-gold',
        terracotta: 'border-terracotta/25 bg-terracotta/10 text-terracotta',
        success: 'border-success/25 bg-success/10 text-success',
        warning: 'border-warning/50 bg-warning/20 text-warning-foreground dark:text-warning',
        info: 'border-info/25 bg-info/10 text-info',
        destructive: 'border-destructive/25 bg-destructive/10 text-destructive',
        synthetic:
          'border-dashed border-muted-foreground/40 bg-[repeating-linear-gradient(135deg,color-mix(in_oklch,var(--muted-foreground)_12%,transparent)_0_4px,transparent_4px_8px)] font-semibold tracking-wider text-muted-foreground uppercase',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

function Badge({
  className,
  variant,
  dot = false,
  asChild = false,
  children,
  ...props
}: React.ComponentProps<'span'> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean; dot?: boolean }) {
  const Comp = asChild ? Slot.Root : 'span';
  return (
    <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" />}
      {children}
    </Comp>
  );
}

export { Badge, badgeVariants };
