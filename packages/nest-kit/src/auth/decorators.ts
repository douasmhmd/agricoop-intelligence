import {
  applyDecorators,
  createParamDecorator,
  type ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import type { RealmRole } from '@agricoop/shared';
import { RequestContext } from '../context/request-context.js';
import type { AuthUser } from './auth-user.js';

export const IS_PUBLIC = 'agricoop:isPublic';
export const ROLES = 'agricoop:roles';
export const NO_TENANT = 'agricoop:noTenant';

/** No authentication, no tenant from the token (public catalogue, QR verification, probes). */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC, true);

/**
 * Authenticated route that does not run in a token tenant (e.g. /me, storefront routes whose tenant
 * comes from /coops/:code, platform admin routes). Without it, authenticated routes REQUIRE a tenant.
 */
export const NoTenant = (): MethodDecorator & ClassDecorator =>
  applyDecorators(SetMetadata(NO_TENANT, true), ApiBearerAuth('bearer'));

/**
 * Restricts a route to any of `roles`. `saas_admin` always passes (it then acts on the tenant chosen
 * with the X-Coop-Id header, which is audited).
 */
export const Roles = (...roles: RealmRole[]): MethodDecorator & ClassDecorator =>
  applyDecorators(
    SetMetadata(ROLES, roles),
    ApiBearerAuth('bearer'),
    ApiHeader({
      name: 'X-Coop-Id',
      required: false,
      description: 'saas_admin only: cooperative (coop_id) to act on. Audited.',
    }),
  );

/** The authenticated caller (undefined on public routes). */
export const CurrentUser = createParamDecorator(
  (_: unknown, _ctx: ExecutionContext): AuthUser | undefined => RequestContext.current()?.user,
);
