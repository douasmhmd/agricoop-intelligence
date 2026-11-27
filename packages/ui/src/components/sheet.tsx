import { Dialog as SheetPrimitive } from 'radix-ui';
import type * as React from 'react';
import { cn } from '../lib/cn';
import { CloseButton, overlayClasses } from './dialog';

/*
 * Side panel (cart, filters, mobile menu) built on the Radix dialog. Sides are LOGICAL: `end` is the
 * right edge in French and the left edge in Arabic, and the slide direction follows.
 */

type Side = 'start' | 'end' | 'top' | 'bottom';

function Sheet(props: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger(props: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose(props: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

const sideClasses: Record<Side, string> = {
  end: 'inset-y-0 end-0 h-full w-[min(26rem,calc(100%-2.5rem))] border-s rounded-s-2xl data-[state=open]:slide-in-from-end data-[state=closed]:slide-out-to-end',
  start:
    'inset-y-0 start-0 h-full w-[min(22rem,calc(100%-2.5rem))] border-e rounded-e-2xl data-[state=open]:slide-in-from-start data-[state=closed]:slide-out-to-start',
  top: 'inset-x-0 top-0 max-h-[85dvh] border-b rounded-b-2xl data-[state=open]:slide-in-from-top data-[state=closed]:slide-out-to-top',
  bottom:
    'inset-x-0 bottom-0 max-h-[85dvh] border-t rounded-t-2xl pb-[max(1.5rem,env(safe-area-inset-bottom))] data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom',
};

function SheetContent({
  className,
  children,
  side = 'end',
  showCloseButton = true,
  closeLabel = 'Fermer',
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: Side;
  showCloseButton?: boolean;
  closeLabel?: string;
}) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay data-slot="sheet-overlay" className={overlayClasses} />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        data-side={side}
        className={cn(
          'fixed z-50 flex flex-col gap-4 overflow-y-auto border-border/70 bg-popover p-6 text-popover-foreground shadow-float outline-none',
          'data-[state=open]:animate-in data-[state=open]:duration-500 data-[state=open]:ease-out-expo data-[state=closed]:animate-out data-[state=closed]:duration-250 data-[state=closed]:ease-in-out-quint',
          sideClasses[side],
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && <CloseButton label={closeLabel} />}
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-header"
      className={cn('flex flex-col gap-1 pe-8', className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn('mt-auto flex flex-col gap-2 pt-2', className)}
      {...props}
    />
  );
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn('font-display text-xl font-semibold tracking-tight', className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
};
