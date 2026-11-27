import { AppProblem } from '@agricoop/nest-kit';

export interface CoopProvisioning {
  coopId: string;
  code: string;
  /** PERSONAL DATA: sent to Keycloak only, never stored or logged by the platform. */
  manager: { email: string; firstName: string; lastName: string };
}

export interface ProvisionedIdentity {
  groupId: string;
  userId: string;
}

/**
 * Identity-provider administration port (Keycloak Admin API in production, in-memory in tests):
 * a cooperative = a group `/coops/<CODE>` carrying `tenant_id`, plus its first `coop_manager` user.
 */
export interface IdentityAdmin {
  provisionCooperative(input: CoopProvisioning): Promise<ProvisionedIdentity>;
  /** Compensation when the database transaction fails after provisioning. */
  deprovision(identity: ProvisionedIdentity): Promise<void>;
}

export const IDENTITY_ADMIN = Symbol.for('agricoop.IDENTITY_ADMIN');

export const managerExists = () =>
  new AppProblem(
    409,
    'gestionnaire_existe',
    'Manager account exists',
    'An account already uses this e-mail',
  );

export const identityUnavailable = () =>
  new AppProblem(
    502,
    'idp_indisponible',
    'Identity provider unavailable',
    'Keycloak could not be updated',
  );

export interface KeycloakAdminOptions {
  /** e.g. http://keycloak:8080 */
  baseUrl: string;
  realm: string;
  clientId: string;
  clientSecret: string;
}

/** Keycloak Admin REST API with the `agricoop-provisioner` service account (client credentials). */
export class KeycloakIdentityAdmin implements IdentityAdmin {
  constructor(private readonly options: KeycloakAdminOptions) {}

  private get admin(): string {
    return `${this.options.baseUrl}/admin/realms/${this.options.realm}`;
  }

  private async token(): Promise<string> {
    const res = await fetch(
      `${this.options.baseUrl}/realms/${this.options.realm}/protocol/openid-connect/token`,
      {
        method: 'POST',
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.options.clientId,
          client_secret: this.options.clientSecret,
        }),
      },
    );
    if (!res.ok) throw identityUnavailable();
    return ((await res.json()) as { access_token: string }).access_token;
  }

  private async call(
    token: string,
    method: string,
    path: string,
    body?: unknown,
  ): Promise<Response> {
    return fetch(`${this.admin}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  }

  private static createdId(res: Response): string {
    const id = res.headers.get('location')?.split('/').pop();
    if (!id) throw identityUnavailable();
    return id;
  }

  async provisionCooperative(input: CoopProvisioning): Promise<ProvisionedIdentity> {
    const token = await this.token();

    const parents = await this.call(token, 'GET', '/groups?search=coops&exact=true');
    const parent = ((await parents.json()) as { id: string; name: string }[]).find(
      (g) => g.name === 'coops',
    );
    if (!parent) throw identityUnavailable();

    const group = await this.call(token, 'POST', `/groups/${parent.id}/children`, {
      name: input.code,
      attributes: { tenant_id: [input.coopId], coop_code: [input.code] },
    });
    if (!group.ok) throw identityUnavailable();
    const groupId = KeycloakIdentityAdmin.createdId(group);

    let userId: string | undefined;
    try {
      const user = await this.call(token, 'POST', '/users', {
        username: input.manager.email,
        email: input.manager.email,
        firstName: input.manager.firstName,
        lastName: input.manager.lastName,
        enabled: true,
        emailVerified: false,
        groups: [`/coops/${input.code}`],
        requiredActions: ['UPDATE_PASSWORD', 'VERIFY_EMAIL'],
      });
      if (user.status === 409) throw managerExists();
      if (!user.ok) throw identityUnavailable();
      userId = KeycloakIdentityAdmin.createdId(user);

      // The user-scoped "available roles" listing only needs manage-users (GET /roles/{name} would
      // need view-realm, which the provisioner deliberately does not have).
      const available = await this.call(
        token,
        'GET',
        `/users/${userId}/role-mappings/realm/available`,
      );
      if (!available.ok) throw identityUnavailable();
      const role = ((await available.json()) as { id: string; name: string }[]).find(
        (r) => r.name === 'coop_manager',
      );
      if (!role) throw identityUnavailable();
      const mapped = await this.call(token, 'POST', `/users/${userId}/role-mappings/realm`, [role]);
      if (!mapped.ok) throw identityUnavailable();

      // Invitation e-mail (Mailpit locally). A failure here must not undo the tenant: the admin can
      // resend it from Keycloak.
      await this.call(token, 'PUT', `/users/${userId}/execute-actions-email`, [
        'UPDATE_PASSWORD',
        'VERIFY_EMAIL',
      ]).catch(() => undefined);

      return { groupId, userId };
    } catch (error) {
      // Undo everything created so far: no orphan account, no orphan group.
      if (userId) await this.call(token, 'DELETE', `/users/${userId}`).catch(() => undefined);
      await this.call(token, 'DELETE', `/groups/${groupId}`).catch(() => undefined);
      throw error;
    }
  }

  async deprovision(identity: ProvisionedIdentity): Promise<void> {
    const token = await this.token();
    await this.call(token, 'DELETE', `/users/${identity.userId}`);
    await this.call(token, 'DELETE', `/groups/${identity.groupId}`);
  }
}

/** Test double / local fallback when no provisioner secret is configured. */
export class InMemoryIdentityAdmin implements IdentityAdmin {
  readonly cooperatives = new Map<string, CoopProvisioning>();
  failNext = false;

  provisionCooperative(input: CoopProvisioning): Promise<ProvisionedIdentity> {
    if (this.failNext) {
      this.failNext = false;
      return Promise.reject(identityUnavailable());
    }
    if ([...this.cooperatives.values()].some((c) => c.manager.email === input.manager.email)) {
      return Promise.reject(managerExists());
    }
    this.cooperatives.set(input.code, input);
    return Promise.resolve({ groupId: `group-${input.code}`, userId: `user-${input.code}` });
  }

  deprovision(identity: ProvisionedIdentity): Promise<void> {
    this.cooperatives.delete(identity.groupId.replace(/^group-/, ''));
    return Promise.resolve();
  }
}
