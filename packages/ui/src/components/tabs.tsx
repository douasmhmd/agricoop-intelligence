import { LayoutGroup, motion } from 'motion/react';
import { Tabs as TabsPrimitive } from 'radix-ui';
import * as React from 'react';
import { cn } from '../lib/cn';
import { spring } from '../motion';

/*
 * Radix tabs with an active indicator that slides between triggers (Motion layoutId). The current
 * value is mirrored in a context so each trigger knows whether to render the indicator; controlled
 * and uncontrolled use both work as with Radix.
 */

const TabsValueContext = React.createContext<string | undefined>(undefined);

function Tabs({
  className,
  value,
  defaultValue,
  onValueChange,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  const [inner, setInner] = React.useState(defaultValue);
  const current = value ?? inner;
  const id = React.useId();
  return (
    <TabsValueContext.Provider value={current}>
      <LayoutGroup id={id}>
        <TabsPrimitive.Root
          data-slot="tabs"
          value={current}
          onValueChange={(v) => {
            if (value === undefined) setInner(v);
            onValueChange?.(v);
          }}
          className={cn('flex flex-col gap-3', className)}
          {...props}
        />
      </LayoutGroup>
    </TabsValueContext.Provider>
  );
}

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        'inline-flex w-fit max-w-full items-center gap-0.5 overflow-x-auto rounded-lg border border-border/70 bg-muted/70 p-1 text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  children,
  value,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const active = React.useContext(TabsValueContext) === value;
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      value={value}
      className={cn(
        'relative inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors duration-200',
        'hover:text-foreground disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-foreground',
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      {active && (
        <motion.span
          layoutId="tabs-indicator"
          aria-hidden
          className="absolute inset-0 rounded-md border border-border/60 bg-card shadow-soft"
          transition={spring.snappy}
        />
      )}
      <span className="relative z-10 inline-flex items-center gap-1.5">{children}</span>
    </TabsPrimitive.Trigger>
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn(
        'flex-1 outline-none data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:duration-300',
        className,
      )}
      {...props}
    />
  );
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
