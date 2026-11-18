import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from 'react-oidc-context';
import { toast } from 'sonner';
import { consumeSignedOut } from './sign-out';

const currentPath = () => `${window.location.pathname}${window.location.search}`;

/**
 * Session notices, in the app's style: "signed out" once after Keycloak's logout redirect, and
 * "session expired" (with a sign-in-again action) when the token can no longer be renewed.
 */
export function SessionNotices() {
  const auth = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    if (consumeSignedOut()) toast.success(t('auth.signedOut'));
  }, [t]);

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
