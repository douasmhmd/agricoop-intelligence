import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@agricoop/ui';
import { TriangleAlert } from 'lucide-react';
import { type ReactNode, useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
}

/**
 * Promise-based confirmation in a branded dialog: `if (!(await confirm({...}))) return;`.
 * Render the returned element once in the page.
 */
export function useConfirm(): [(options: ConfirmOptions) => Promise<boolean>, ReactNode] {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  // Kept after closing so the dialog keeps its text during the exit animation.
  const [options, setOptions] = useState<ConfirmOptions>({ title: '' });
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((next: ConfirmOptions) => {
    setOptions(next);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);
  const settle = (value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOpen(false);
  };

  const element = (
    <Dialog open={open} onOpenChange={(o) => !o && settle(false)}>
      <DialogContent className="max-w-md">
        <DialogHeader className="flex-row items-start gap-3 text-start">
          <span
            className={cn(
              'grid size-10 shrink-0 place-items-center rounded-full',
              options.destructive
                ? 'bg-destructive/10 text-destructive'
                : 'bg-warning/20 text-warning-foreground dark:text-warning',
            )}
          >
            <TriangleAlert className="size-5" aria-hidden />
          </span>
          <div className="grid gap-1.5">
            <DialogTitle>{options.title}</DialogTitle>
            {options.description && <DialogDescription>{options.description}</DialogDescription>}
          </div>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => settle(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant={options.destructive ? 'destructive' : 'default'}
            onClick={() => settle(true)}
            autoFocus
          >
            {options.confirmLabel ?? t('common.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
  return [confirm, element];
}
