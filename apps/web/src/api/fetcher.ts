import type { ProblemDetails } from '@agricoop/shared';

/*
 * The ONLY place that calls fetch(): Orval's mutator. Every API call goes through the generated
 * client (src/api/generated), which delegates here. Requests are same-origin (/api/v1, /qr/v1).
 */

type AccessTokenProvider = () => string | undefined | Promise<string | undefined>;

let accessTokenProvider: AccessTokenProvider = () => undefined;

/** Called by the auth layer (react-oidc-context) once the user is signed in. */
export function setAccessTokenProvider(provider: AccessTokenProvider): void {
  accessTokenProvider = provider;
}

/** RFC 7807 error raised for every non-2xx response. */
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

  const response = await fetch(url, { ...init, headers });
  const contentType = response.headers.get('content-type') ?? '';
  const body: unknown =
    response.status === 204
      ? undefined
      : contentType.includes('json')
        ? await response.json()
        : await response.text();

  if (!response.ok) {
    throw new ApiError(
      response.status,
      contentType.includes('json') ? (body as ProblemDetails) : undefined,
    );
  }
  return body as T;
}
