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

describe('apiFetch binary responses', () => {
  it('returns PDFs as a Blob', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(new Uint8Array([37, 80, 68, 70]), {
            status: 201,
            headers: { 'content-type': 'application/pdf' },
          }),
        ),
      ),
    );
    const res = await apiFetch<{ data: Blob; status: number }>('/qr/v1/lots/x/qr-codes', {
      method: 'POST',
    });
    expect(res.status).toBe(201);
    // jsdom and Node expose different Blob classes: check the shape, not the realm.
    expect(res.data.type).toBe('application/pdf');
    expect(await res.data.text()).toBe('%PDF');
    vi.unstubAllGlobals();
  });
});
