import type { ProblemDetails } from '@agricoop/shared';

/*
 * The ONLY place that calls fetch(): Orval's mutator. Every API call goes through the generated
 * client (src/api/generated), which delegates here. Requests are same-origin (/api/v1, /qr/v1).
 *
 * Contract with the generated code (Orval 8, httpClient "fetch"): resolve with
 * `{ data, status, headers }` for 2xx responses. Non-2xx responses THROW an ApiError so TanStack Query
 * puts the query in its error state; the 4XX/5XX members of the generated response unions therefore
 * never reach callers.
 */

type AccessTokenProvider = () => string | undefined | Promise<string | undefined>;

let accessTokenProvider: AccessTokenProvider = () => undefined;

/** Called by the auth layer (react-oidc-context) once the user is signed in. */
export function setAccessTokenProvider(provider: AccessTokenProvider): void {
  accessTokenProvider = provider;
}

let coopHeaderProvider: () => string | undefined = () => undefined;

/** saas_admin only: the cooperative to act on, sent as X-Coop-Id (audited by the API). */
export function setCoopHeaderProvider(provider: () => string | undefined): void {
  coopHeaderProvider = provider;
}

/** RFC 7807 error raised for every non-2xx response. `problem.code` is stable: translate on it. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly problem: ProblemDetails | undefined,
  ) {
    super(problem?.title ?? `HTTP ${status}`);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('accept', 'application/json, application/problem+json');
  const token = await accessTokenProvider();
  if (token) headers.set('authorization', `Bearer ${token}`);
  const coopId = coopHeaderProvider();
  if (coopId) headers.set('x-coop-id', coopId);

  const response = await fetch(url, { ...init, headers });
  const contentType = response.headers.get('content-type') ?? '';
  const isJson = contentType.includes('json');
  const isBinary = /application\/(pdf|octet-stream)/.test(contentType);
  const data: unknown =
    response.status === 204
      ? undefined
      : isJson
        ? await response.json()
        : isBinary
          ? await response.blob() // e.g. QR label sheets (application/pdf)
          : await response.text();

  if (!response.ok) {
    throw new ApiError(response.status, isJson ? (data as ProblemDetails) : undefined);
  }
  return { data, status: response.status, headers: response.headers } as T;
}
