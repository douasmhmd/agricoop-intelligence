import { Button, Input, Ornament, ZelligeBackdrop } from '@agricoop/ui';
import { fadeUp, revealViewport, stagger } from '@agricoop/ui/motion';
import { Mail } from 'lucide-react';
import { motion } from 'motion/react';
import { type FormEvent, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';

/**
 * Newsletter sign-up. There is no newsletter service behind it yet (it would need an API
 * endpoint), so a valid address only gets an honest "opening soon" message and is not stored.
 */
export function Newsletter() {
  const { t } = useTranslation();
  const id = useId();
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = new FormData(event.currentTarget).get('email');
    if (!z.email().safeParse(email).success) {
      setError(t('newsletter.invalid'));
      return;
    }
    setError(null);
    event.currentTarget.reset();
    toast.info(t('newsletter.soon'));
  };

  return (
    <section aria-labelledby={`${id}-title`} className="px-4 pb-24 sm:px-6 sm:pb-28 lg:px-8">
      <motion.div
        variants={stagger(0.08)}
        initial="hidden"
        whileInView="visible"
        viewport={revealViewport}
        className="grain relative isolate mx-auto max-w-5xl overflow-hidden rounded-2xl border bg-card px-6 py-14 text-center shadow-lifted sm:px-12"
      >
        <ZelligeBackdrop className="-z-10" />
        <motion.span
          variants={fadeUp}
          className="mx-auto grid size-12 place-items-center rounded-full bg-gold/15 text-gold-700 dark:text-gold"
        >
          <Mail className="size-5" aria-hidden />
        </motion.span>
        <motion.h2
          id={`${id}-title`}
          variants={fadeUp}
          className="mt-5 font-display text-display-md font-semibold"
        >
          {t('newsletter.title')}
        </motion.h2>
        <motion.p variants={fadeUp} className="mx-auto mt-3 max-w-lg text-muted-foreground">
          {t('newsletter.text')}
        </motion.p>
        <motion.form
          variants={fadeUp}
          onSubmit={submit}
          noValidate
          className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row"
        >
          <label htmlFor={`${id}-email`} className="sr-only">
            {t('newsletter.email')}
          </label>
          <Input
            id={`${id}-email`}
            name="email"
            type="email"
            autoComplete="email"
            placeholder={t('newsletter.email')}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            className="h-12 rounded-full px-5"
            dir="ltr"
          />
          <Button type="submit" size="xl" shape="pill" className="h-12">
            {t('newsletter.submit')}
          </Button>
        </motion.form>
        {error && (
          <p id={`${id}-error`} role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        )}
        <Ornament className="mx-auto mt-10 max-w-xs" />
      </motion.div>
    </section>
  );
}
