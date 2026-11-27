import { HttpException } from '@nestjs/common';

/**
 * Application error rendered as RFC 7807 problem details:
 *   { type: "urn:agricoop:problem:<code>", title, status, detail, code }
 * `code` is stable and machine-readable (front ends translate it); `detail` must never contain
 * personal data.
 */
export class AppProblem extends HttpException {
  constructor(
    status: number,
    readonly code: string,
    readonly title: string,
    readonly detail?: string,
    /** RFC 7807 extension members (machine-readable details; never personal data). */
    readonly extensions?: Record<string, unknown>,
  ) {
    super(detail ?? title, status);
  }
}

export const Problems = {
  notFound: (what: string) =>
    new AppProblem(404, 'not_found', 'Resource not found', `${what} not found`),
  tenantRequired: () =>
    new AppProblem(403, 'tenant_required', 'Tenant required', 'This route requires a cooperative'),
  tenantMismatch: () =>
    new AppProblem(
      403,
      'tenant_mismatch',
      'Forbidden',
      'X-Coop-Id does not match your cooperative',
    ),
  coopHeaderRequired: () =>
    new AppProblem(
      400,
      'coop_header_required',
      'X-Coop-Id required',
      'saas_admin must choose a cooperative with the X-Coop-Id header',
    ),
  invalidCoopHeader: () =>
    new AppProblem(400, 'invalid_coop_header', 'Invalid X-Coop-Id', 'X-Coop-Id must be a UUID'),
  unknownCooperative: () =>
    new AppProblem(404, 'unknown_cooperative', 'Cooperative not found', 'Unknown cooperative'),
  conflict: (code: string, detail: string) => new AppProblem(409, code, 'Conflict', detail),
};
