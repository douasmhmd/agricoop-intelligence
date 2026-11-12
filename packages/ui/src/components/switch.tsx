import { Switch as SwitchPrimitive } from 'radix-ui';
import type * as React from 'react';
import { cn } from '../lib/cn';

/** The thumb moves towards the inline end: right in French, left in Arabic. */
function Switch({
  className,
  size = 'default',
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & { size?: 'sm' | 'default' }) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        'peer group/switch inline-flex shrink-0 cursor-pointer items-center rounded-full border border-transparent p-0.5 shadow-[inset_0_1px_2px_oklch(0_0_0/0.12)] transition-colors duration-200',
        'data-[size=default]:h-6 data-[size=default]:w-10 data-[size=sm]:h-5 data-[size=sm]:w-8',
        'data-[state=checked]:bg-primary data-[state=unchecked]:bg-input',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          'pointer-events-none block rounded-full bg-card shadow-[0_1px_3px_oklch(0_0_0/0.25)] ring-0 transition-transform duration-300 ease-spring',
          'group-data-[size=default]/switch:size-5 group-data-[size=sm]/switch:size-4',
          'data-[state=unchecked]:translate-x-0',
          'group-data-[size=default]/switch:data-[state=checked]:translate-x-4 rtl:group-data-[size=default]/switch:data-[state=checked]:-translate-x-4',
          'group-data-[size=sm]/switch:data-[state=checked]:translate-x-3 rtl:group-data-[size=sm]/switch:data-[state=checked]:-translate-x-3',
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
