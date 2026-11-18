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
}: {
  id: string;
  name?: string;
  label: string;
  busyLabel: string;
  submitting: boolean;
}) {
  return (
    <Button
      type="submit"
      id={id}
      name={name}
      value={name}
      size="lg"
      className="mt-1 h-12 w-full text-base"
      disabled={submitting}
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
