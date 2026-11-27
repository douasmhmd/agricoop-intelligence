import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import type * as React from 'react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';
import { useDirection } from '../lib/direction';
import { useTheme } from '../lib/theme';

/** Sonner toasts in the brand: popover surface, soft float shadow, follows theme and direction. */
function Toaster(props: ToasterProps) {
  const { resolved } = useTheme();
  const dir = useDirection();
  return (
    <Sonner
      theme={resolved}
      dir={dir}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4 text-success" />,
        info: <InfoIcon className="size-4 text-info" />,
        warning: <TriangleAlertIcon className="size-4 text-warning-foreground dark:text-warning" />,
        error: <OctagonXIcon className="size-4 text-destructive" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            'font-sans !rounded-xl !border-border/70 !shadow-float !gap-3 !px-4 !py-3 !text-[0.8125rem]',
          title: '!font-semibold',
          description: '!text-muted-foreground',
          actionButton: '!bg-primary !text-primary-foreground !rounded-md',
        },
      }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          '--border-radius': 'var(--radius-xl)',
        } as React.CSSProperties
      }
      {...props}
    />
  );
}

export { Toaster };
