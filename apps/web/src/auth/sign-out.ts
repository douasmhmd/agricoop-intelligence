import type { AuthContextProps } from 'react-oidc-context';

/** Remembered for this tab only, so the app can say "signed out" once Keycloak sends us back. */
export const SIGNED_OUT_KEY = 'agricoop.signedOut';

/** Sign out through Keycloak (ends the SSO session), then a "signed out" notice back in the app. */
export function signOut(auth: AuthContextProps): void {
  try {
    window.sessionStorage.setItem(SIGNED_OUT_KEY, '1');
  } catch {
    // Storage blocked: the notice is skipped, signing out still works.
  }
  void auth.signoutRedirect();
}

/** True once after a sign-out started here (read and cleared). */
export function consumeSignedOut(): boolean {
  try {
    const signedOut = window.sessionStorage.getItem(SIGNED_OUT_KEY) !== null;
    window.sessionStorage.removeItem(SIGNED_OUT_KEY);
    return signedOut;
  } catch {
    return false;
  }
}
