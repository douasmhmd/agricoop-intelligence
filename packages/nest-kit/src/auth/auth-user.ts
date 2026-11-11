import { REALM_ROLES, type RealmRole } from '@agricoop/shared';
import type { JWTPayload } from 'jose';

/** The authenticated caller, derived from a verified Keycloak access token. */
export interface AuthUser {
  /** Keycloak subject. Pseudonymous: never put it in events or analytics. */
  sub: string;
  roles: RealmRole[];
  /** `tenant_id` claim (= coop_id), set for cooperative staff only. */
  tenantId?: string;
}

interface KeycloakClaims extends JWTPayload {
  realm_access?: { roles?: unknown };
  tenant_id?: unknown;
}

export function toAuthUser(payload: JWTPayload): AuthUser {
  const claims = payload as KeycloakClaims;
  if (typeof claims.sub !== 'string' || claims.sub.length === 0) {
    throw new Error('Token has no subject');
  }
  const rawRoles = Array.isArray(claims.realm_access?.roles) ? claims.realm_access.roles : [];
  const roles = REALM_ROLES.filter((r) => rawRoles.includes(r));
  const tenantId =
    typeof claims.tenant_id === 'string' && claims.tenant_id.length > 0
      ? claims.tenant_id
      : undefined;
  return { sub: claims.sub, roles, ...(tenantId ? { tenantId } : {}) };
}

export function hasRole(user: AuthUser | undefined, role: RealmRole): boolean {
  return user?.roles.includes(role) ?? false;
}
