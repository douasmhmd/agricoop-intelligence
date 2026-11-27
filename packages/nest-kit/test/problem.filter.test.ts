import { type ArgumentsHost, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ZodValidationException } from 'nestjs-zod';
import { z } from 'zod';
import { AppProblem, Problems } from '../src/problem/problem.js';
import { PROBLEM_CONTENT_TYPE, ProblemDetailsFilter } from '../src/problem/problem.filter.js';

function run(exception: unknown, url = '/api/v1/produits?email=x@y.ma') {
  const sent: { status?: number; headers: Record<string, string>; body?: unknown } = {
    headers: {},
  };
  const reply = {
    status: vi.fn((s: number) => ((sent.status = s), reply)),
    header: vi.fn((k: string, v: string) => ((sent.headers[k] = v), reply)),
    send: vi.fn((b: unknown) => ((sent.body = b), reply)),
  };
  const host = {
    switchToHttp: () => ({ getResponse: () => reply, getRequest: () => ({ url, id: 'r1' }) }),
  } as unknown as ArgumentsHost;
  const filter = new ProblemDetailsFilter();
  // Silence the server-side log of 500s in test output.
  (filter as unknown as { logger: { error: () => void } }).logger = { error: vi.fn() };
  filter.catch(exception, host);
  return sent;
}

describe('ProblemDetailsFilter', () => {
  it('renders AppProblem with a stable code and problem+json content type', () => {
    const sent = run(Problems.conflict('stock_insuffisant', 'Not enough stock'));
    expect(sent.status).toBe(409);
    expect(sent.headers['content-type']).toBe(PROBLEM_CONTENT_TYPE);
    expect(sent.body).toEqual({
      type: 'urn:agricoop:problem:stock_insuffisant',
      title: 'Conflict',
      status: 409,
      code: 'stock_insuffisant',
      detail: 'Not enough stock',
      instance: '/api/v1/produits',
    });
  });

  it('drops the query string from `instance`', () => {
    expect((run(new NotFoundException()).body as { instance: string }).instance).toBe(
      '/api/v1/produits',
    );
  });

  it('never leaks the message of an unexpected error', () => {
    const sent = run(new Error('duplicate key for email fatima@example.ma'));
    expect(sent.status).toBe(500);
    expect(JSON.stringify(sent.body)).not.toContain('fatima');
    expect(sent.body).toMatchObject({ title: 'Internal Server Error', status: 500 });
  });

  it('lists validation errors by path without echoing input values', () => {
    const schema = z.object({ prix_mad: z.string(), quantite: z.number().int() });
    const result = schema.safeParse({ prix_mad: 12, quantite: 'secret-value' });
    const sent = run(new ZodValidationException(result.error!));
    expect(sent.status).toBe(400);
    const body = sent.body as { code: string; errors: { path: string }[] };
    expect(body.code).toBe('validation');
    expect(body.errors.map((e) => e.path)).toEqual(['prix_mad', 'quantite']);
    expect(JSON.stringify(body)).not.toContain('secret-value');
  });

  it('adds WWW-Authenticate on 401', () => {
    const sent = run(new AppProblem(401, 'unauthorized', 'Unauthorized'));
    expect(sent.headers['www-authenticate']).toBe('Bearer');
  });
});
