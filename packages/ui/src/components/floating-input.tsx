import { Eye, EyeOff, TriangleAlert } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import * as React from 'react';
import { cn } from '../lib/cn';
import { fadeUpSmall } from '../motion';
import { fieldClasses } from './input';

/*
 * Input with a floating label: the label sits inside the field and moves up (transform only) when
 * the field is focused or filled. Options for passwords: a show/hide toggle and a caps-lock
 * warning. `error` animates in under the field and is linked with aria-describedby.
 * Pass translated strings from the app (`toggleLabels`, `capsLockMessage`).
 */
export interface FloatingInputProps extends Omit<React.ComponentProps<'input'>, 'placeholder'> {
  id: string;
  label: React.ReactNode;
  /** Message under the field (already translated; may be a sanitized HTML node). */
  error?: React.ReactNode;
  /** Marks the field invalid without a message of its own (e.g. a shared username/password error). */
  invalid?: boolean;
  hint?: React.ReactNode;
  /** Password fields: show / hide toggle with these accessible names. */
  toggleLabels?: { show: string; hide: string };
  /** Password fields: warning shown while Caps Lock is on. */
  capsLockMessage?: string;
}

export function FloatingInput({
  id,
  label,
  error,
  invalid = false,
  hint,
  toggleLabels,
  capsLockMessage,
  type = 'text',
  className,
  onKeyDown,
  onKeyUp,
  onBlur,
  ...props
}: FloatingInputProps) {
  const [revealed, setRevealed] = React.useState(false);
  const [capsLock, setCapsLock] = React.useState(false);
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const capsId = `${id}-caps`;
  const describedBy =
    [error ? errorId : hint ? hintId : null, capsLock && capsLockMessage ? capsId : null]
      .filter(Boolean)
      .join(' ') || undefined;

  const trackCapsLock = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (capsLockMessage) setCapsLock(event.getModifierState('CapsLock'));
  };

  return (
    <div className={cn('grid gap-1.5', className)}>
      <div className="relative">
        <input
          id={id}
          type={toggleLabels && revealed ? 'text' : type}
          // A single space: lets CSS know whether the field is empty (:placeholder-shown).
          placeholder=" "
          aria-invalid={error || invalid ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            fieldClasses,
            'peer h-14 rounded-lg pt-5 pb-1.5 text-base',
            toggleLabels && 'pe-12',
          )}
          onKeyDown={(e) => {
            trackCapsLock(e);
            onKeyDown?.(e);
          }}
          onKeyUp={(e) => {
            trackCapsLock(e);
            onKeyUp?.(e);
          }}
          onBlur={(e) => {
            setCapsLock(false);
            onBlur?.(e);
          }}
          {...props}
        />
        <label
          htmlFor={id}
          className={cn(
            'pointer-events-none absolute start-3 top-4 origin-left text-base text-muted-foreground rtl:origin-right',
            'transition-transform duration-200 ease-out-expo',
            // Focused or filled: up and smaller (transform only).
            'peer-focus:-translate-y-2.5 peer-focus:scale-[0.78] peer-focus:text-foreground',
            'peer-[:not(:placeholder-shown)]:-translate-y-2.5 peer-[:not(:placeholder-shown)]:scale-[0.78]',
            'peer-aria-invalid:text-destructive',
          )}
        >
          {label}
        </label>
        {toggleLabels && (
          <button
            type="button"
            onClick={() => setRevealed((r) => !r)}
            aria-label={revealed ? toggleLabels.hide : toggleLabels.show}
            aria-pressed={revealed}
            aria-controls={id}
            className="absolute end-1.5 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2"
          >
            {revealed ? (
              <EyeOff className="size-[1.125rem]" aria-hidden />
            ) : (
              <Eye className="size-[1.125rem]" aria-hidden />
            )}
          </button>
        )}
      </div>
      <AnimatePresence initial={false}>
        {capsLock && capsLockMessage && (
          <motion.p
            key="caps"
            id={capsId}
            variants={fadeUpSmall}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex items-center gap-1.5 text-xs text-warning-foreground dark:text-warning"
            role="status"
          >
            <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
            {capsLockMessage}
          </motion.p>
        )}
      </AnimatePresence>
      <AnimatePresence initial={false} mode="wait">
        {error ? (
          <motion.p
            key="error"
            id={errorId}
            variants={fadeUpSmall}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="text-sm text-destructive"
            aria-live="polite"
          >
            {error}
          </motion.p>
        ) : (
          hint && (
            <motion.p
              key="hint"
              id={hintId}
              variants={fadeUpSmall}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="text-xs text-muted-foreground"
            >
              {hint}
            </motion.p>
          )
        )}
      </AnimatePresence>
    </div>
  );
}
