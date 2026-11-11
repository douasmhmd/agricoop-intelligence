import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { RealmRole } from '@agricoop/shared';
import type { FastifyRequest } from 'fastify';
import type { ContextualRequest } from '../context/request-context.js';
import { Problems } from '../problem/problem.js';
import { type AuthUser, hasRole } from './auth-user.js';
import { IS_PUBLIC, NO_TENANT, ROLES } from './decorators.js';
import { JWT_VERIFIER, type JwtVerifier } from './jwt-verifier.js';
import { TENANT_DIRECTORY, type TenantDirectory } from './tenant-directory.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const COOP_HEADER = 'x-coop-id';

/**
 * The single global guard, run in a fixed order:
 *   1. authentication — Bearer JWT verified against Keycloak's JWKS (401 on failure);
 *   2. roles          — @Roles(...) any-of, saas_admin always passes (403);
 *   3. tenant         — unless @Public/@NoTenant: the token's tenant_id, or X-Coop-Id for saas_admin
 *                       (audited). Everyone else is locked to their own tenant.
 * The result is attached to the request and exposed through RequestContext.
 */
@Injectable()
export class AccessGuard implements CanActivate {
  private readonly audit = new Logger('Audit');

  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(JWT_VERIFIER) private readonly verifier: JwtVerifier,
    @Inject(TENANT_DIRECTORY) private readonly tenants: TenantDirectory,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const request = context.switchToHttp().getRequest<FastifyRequest & ContextualRequest>();
    const meta = <T>(key: string) =>
      this.reflector.getAllAndOverride<T | undefined>(key, [
        context.getHandler(),
        context.getClass(),
      ]);

    const isPublic = meta<boolean>(IS_PUBLIC) === true;
    const token = this.bearerToken(request);

    if (isPublic) {
      // Public routes ignore credentials entirely: no user, no token tenant.
      request.agricoop = {};
      return true;
    }

    if (!token) throw new UnauthorizedException('Missing bearer token');
    let user: AuthUser;
    try {
      user = await this.verifier.verify(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const roles = meta<RealmRole[]>(ROLES);
    const isAdmin = hasRole(user, 'saas_admin');
    if (roles && roles.length > 0 && !isAdmin && !roles.some((r) => hasRole(user, r))) {
      throw new ForbiddenException('Insufficient role');
    }

    if (meta<boolean>(NO_TENANT) === true) {
      request.agricoop = { user };
      return true;
    }

    const header = request.headers[COOP_HEADER];
    const requested = Array.isArray(header) ? header[0] : header;

    if (isAdmin) {
      if (!requested) throw Problems.coopHeaderRequired();
      if (!UUID_RE.test(requested)) throw Problems.invalidCoopHeader();
      if (!(await this.tenants.exists(requested))) throw Problems.unknownCooperative();
      this.audit.log({
        audit: 'tenant_override',
        actor: user.sub,
        coop_id: requested,
        method: request.method,
        route: request.routeOptions.url,
      });
      request.agricoop = { user, coopId: requested, adminOverride: true };
      return true;
    }

    if (!user.tenantId || !UUID_RE.test(user.tenantId)) throw Problems.tenantRequired();
    if (requested && requested.toLowerCase() !== user.tenantId.toLowerCase()) {
      throw Problems.tenantMismatch();
    }
    request.agricoop = { user, coopId: user.tenantId };
    return true;
  }

  private bearerToken(request: FastifyRequest): string | undefined {
    const header = request.headers.authorization;
    if (!header) return undefined;
    const [scheme, value] = header.split(' ');
    return scheme?.toLowerCase() === 'bearer' && value ? value : undefined;
  }
}
