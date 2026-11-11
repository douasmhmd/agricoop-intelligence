import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch, setAccessTokenProvider } from '@/api/fetcher';

function mockFetch(status: number, body: unknown, contentType = 'application/json') {
  const fn = vi.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify(body), { status, headers: { 'content-type': contentType } }),
    ),
  );
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('apiFetch (Orval mutator)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setAccessTokenProvider(() => undefined);
  });

  it('resolves 2xx responses as { data, status, headers }', async () => {
    mockFetch(200, { roles: ['customer'], coop_id: null });
    const res = await apiFetch<{ data: unknown; status: number }>('/api/v1/me', { method: 'GET' });
    expect(res.status).toBe(200);
    expect(res.data).toEqual({ roles: ['customer'], coop_id: null });
  });

  it('sends the bearer token from the auth layer', async () => {
    const fetchMock = mockFetch(200, {});
    setAccessTokenProvider(() => 'tok');
    await apiFetch('/api/v1/me');
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer tok');
  });

  it('throws ApiError carrying the problem details on 4xx', async () => {
    mockFetch(
      404,
      {
        type: 'urn:agricoop:problem:not_found',
        title: 'Resource not found',
        status: 404,
        code: 'not_found',
      },
      'application/problem+json',
    );
    const error = await apiFetch('/api/v1/produits/x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(404);
    expect((error as ApiError).problem?.code).toBe('not_found');
  });
});
