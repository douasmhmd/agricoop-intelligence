import 'reflect-metadata';
import { configureApp, DB_POOL, parseEnv } from '@agricoop/nest-kit';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule, GLOBAL_PREFIX } from '../src/app.module';
import { qrEnv } from '../src/env';

describe('qr health and metrics', () => {
  let app: NestFastifyApplication;
  const pool = { query: vi.fn(), end: vi.fn().mockResolvedValue(undefined) };

  beforeAll(async () => {
    const env = parseEnv(qrEnv, {
      DATABASE_URL: 'postgres://test:test@localhost:1/test',
      LOG_LEVEL: 'silent',
      OIDC_ISSUER: 'http://localhost:8080/realms/agricoop',
    });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule.register(env)] })
      .overrideProvider(DB_POOL)
      .useValue(pool)
      .compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    configureApp(app, { globalPrefix: GLOBAL_PREFIX });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health/live → 200', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/live' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok' });
  });

  it('GET /health/ready → 200 when the database answers', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
    const res = await app.inject({ method: 'GET', url: '/health/ready' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok', info: { database: { status: 'up' } } });
  });

  it('GET /health/ready → 503 when the database is down', async () => {
    pool.query.mockRejectedValueOnce(new Error('connection refused'));
    const res = await app.inject({ method: 'GET', url: '/health/ready' });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ status: 'error', error: { database: { status: 'down' } } });
  });

  it('GET /metrics exposes Prometheus metrics with the service label', async () => {
    const res = await app.inject({ method: 'GET', url: '/metrics' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.body).toContain('service="agricoop-qr"');
    expect(res.body).toContain('http_request_duration_seconds');
  });

  it('health endpoints are not under the global prefix', async () => {
    const res = await app.inject({ method: 'GET', url: `/${GLOBAL_PREFIX}/health/live` });
    expect(res.statusCode).toBe(404);
  });
});
