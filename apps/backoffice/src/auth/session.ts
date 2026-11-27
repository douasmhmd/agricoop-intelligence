import { useAuth } from 'react-oidc-context';

/** Claims the back office reads from the access token (UI only: the API enforces everything). */
export interface Session {
  roles: string[];
  /** Cooperative of a manager (token `tenant_id`). */
  coopId: string | undefined;
  isAdmin: boolean;
  isManager: boolean;
  name: string;
}

function decodeAccessToken(token: string | undefined): Record<string, unknown> {
  const payload = token?.split('.')[1];
  if (!payload) return {};
  try {
    const binary = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const json = new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function useSession(): Session | undefined {
  const auth = useAuth();
  if (!auth.user) return undefined;
  const claims = decodeAccessToken(auth.user.access_token);
  const realm = claims.realm_access as { roles?: unknown } | undefined;
  const roles = Array.isArray(realm?.roles) ? (realm.roles as string[]) : [];
  return {
    roles,
    coopId: typeof claims.tenant_id === 'string' ? claims.tenant_id : undefined,
    isAdmin: roles.includes('saas_admin'),
    isManager: roles.includes('coop_manager'),
    name: auth.user.profile.given_name ?? auth.user.profile.preferred_username ?? '',
  };
}
