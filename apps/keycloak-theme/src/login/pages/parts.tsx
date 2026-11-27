import { Button } from '@agricoop/ui';
import { kcSanitize } from 'keycloakify/lib/kcSanitize';
import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';

/** Primary submit with a loading state once the form is sent (no double submit). */
export function SubmitButton({
  id,
  name,
  label,
  busyLabel,
  submitting,
  disabled = false,
}: {
  id: string;
  name?: string;
  label: string;
  busyLabel: string;
  submitting: boolean;
  /** Not submittable yet (client-side validation). */
  disabled?: boolean;
}) {
  return (
    <Button
      type="submit"
      id={id}
      name={name}
      value={name}
      size="lg"
      className="mt-1 h-12 w-full text-base"
      disabled={submitting || disabled}
      aria-busy={submitting || undefined}
    >
      {submitting ? (
        <>
          <Loader2 className="animate-spin" aria-hidden />
          {busyLabel}
        </>
      ) : (
        label
      )}
    </Button>
  );
}

interface Provider {
  alias: string;
  loginUrl: string;
  displayName: string;
}

/** Identity providers configured on the realm (none today): shown under a divider. */
export function SocialProviders({ providers, title }: { providers: Provider[]; title: ReactNode }) {
  return (
    <div id="kc-social-providers" className="mt-6">
      <div className="mb-4 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        {title}
        <span className="h-px flex-1 bg-border" />
      </div>
      <ul className="grid gap-2">
        {providers.map((p) => (
          <li key={p.alias}>
            <a
              id={`social-${p.alias}`}
              href={p.loginUrl}
              className="flex h-11 items-center justify-center rounded-lg border bg-card text-sm font-medium shadow-soft transition-colors hover:bg-muted"
              dangerouslySetInnerHTML={{ __html: kcSanitize(p.displayName) }}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A Keycloak message (may contain markup Keycloak escaped): sanitized, then rendered. */
export function KcHtml({ html, id }: { html: string | undefined; id?: string }) {
  return <span id={id} dangerouslySetInnerHTML={{ __html: kcSanitize(html ?? '') }} />;
}

export function TextLink({
  href,
  children,
  id,
}: {
  href: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <a id={id} href={href} className="font-medium text-primary underline-offset-4 hover:underline">
      {children}
    </a>
  );
}

export function Checkbox({
  id,
  name,
  value,
  defaultChecked,
  children,
}: {
  id: string;
  name: string;
  value?: string;
  defaultChecked?: boolean;
  children: ReactNode;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground"
    >
      <input
        id={id}
        name={name}
        value={value}
        type="checkbox"
        defaultChecked={defaultChecked}
        className="size-4 rounded border-input accent-primary"
      />
      {children}
    </label>
  );
}

/** Secondary action posted with the form (e.g. cancel an application-initiated action). */
export function SecondaryButton({
  id,
  name,
  value,
  children,
}: {
  id?: string;
  name?: string;
  value?: string;
  children: ReactNode;
}) {
  return (
    <Button
      type="submit"
      id={id}
      name={name}
      value={value}
      variant="outline"
      size="lg"
      className="h-12 w-full text-base"
      formNoValidate
    >
      {children}
    </Button>
  );
}

/** Paragraph of instructions inside the card. */
export function Instruction({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <p id={id} className="text-sm leading-relaxed text-muted-foreground">
      {children}
    </p>
  );
}
