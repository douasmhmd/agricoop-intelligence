import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from 'react-oidc-context';
import { toast } from 'sonner';

const currentPath = () => `${window.location.pathname}${window.location.search}`;

/**
 * "Session expired" notice (with a sign-in-again action) when the token can no longer be renewed.
 * Signing out ends on the root's "signed out" screen (routes/__root.tsx).
 */
export function SessionNotices() {
  const auth = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    const expired = () => {
      toast.warning(t('auth.sessionExpired'), {
        id: 'session-expired',
        duration: Infinity,
        action: {
          label: t('auth.signInAgain'),
          onClick: () => void auth.signinRedirect({ state: { returnTo: currentPath() } }),
        },
      });
    };
    const offRenew = auth.events.addSilentRenewError(expired);
    const offExpired = auth.events.addAccessTokenExpired(expired);
    return () => {
      offRenew();
      offExpired();
    };
  }, [auth, t]);

  return null;
}
