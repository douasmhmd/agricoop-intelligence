import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import type * as React from 'react';
import { cn } from '../lib/cn';

/*
 * Press feedback is CSS (scale on :active) so it costs nothing and needs no JS. Heights: `default`
 * 40px for the dense back office, `lg` 44px (touch target minimum) and `xl` 52px for the storefront.
 */
const buttonVariants = cva(
  [
    'relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 font-medium whitespace-nowrap select-none',
    'rounded-md text-sm transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-200 ease-out-expo',
    'active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50',
    'aria-invalid:border-destructive',
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ].join(' '),
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-[inset_0_1px_0_0_oklch(1_0_0/0.14),var(--elevation-1)] hover:bg-primary/90 hover:shadow-[inset_0_1px_0_0_oklch(1_0_0/0.14),var(--elevation-2)]',
        gold: 'bg-gold text-gold-foreground shadow-[inset_0_1px_0_0_oklch(1_0_0/0.3),var(--elevation-1)] hover:brightness-105 hover:shadow-[inset_0_1px_0_0_oklch(1_0_0/0.3),var(--elevation-2)]',
        destructive:
          'bg-destructive text-destructive-foreground shadow-soft hover:bg-destructive/90',
        outline:
          'border border-input bg-card/60 shadow-soft hover:border-foreground/25 hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/70',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'h-auto px-0 text-primary underline decoration-gold/60 decoration-1 underline-offset-4 hover:decoration-gold active:scale-100',
      },
      size: {
        xs: "h-7 gap-1 rounded-sm px-2 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        sm: 'h-8 gap-1.5 px-3 text-[0.8125rem]',
        default: 'h-10 px-4',
        lg: 'h-11 px-6 text-[0.9375rem]',
        xl: 'h-13 rounded-lg px-8 text-base',
        icon: 'size-10',
        'icon-xs': "size-7 rounded-sm [&_svg:not([class*='size-'])]:size-3.5",
        'icon-sm': 'size-8',
        'icon-lg': 'size-11',
      },
      shape: {
        default: '',
        pill: 'rounded-full',
      },
    },
    defaultVariants: { variant: 'default', size: 'default', shape: 'default' },
  },
);

function Button({
  className,
  variant,
  size,
  shape,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : 'button';
  return (
    <Comp
      data-slot="button"
      data-variant={variant ?? 'default'}
      className={cn(buttonVariants({ variant, size, shape, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
