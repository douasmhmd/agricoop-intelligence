import { describe, expect, it } from 'vitest';
import { baseEnv, parseEnv } from '../src/env.js';

describe('parseEnv', () => {
  it('applies defaults and parses CORS origins', () => {
    const env = parseEnv(baseEnv, {
      DATABASE_URL: 'postgres://u:p@localhost:5433/agricoop',
      OIDC_ISSUER: 'http://localhost:8080/realms/agricoop',
      CORS_ORIGINS: 'http://localhost:5173, http://localhost:5174',
    });
    expect(env.NODE_ENV).toBe('development');
    expect(env.LOG_PRETTY).toBe(false);
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:5173', 'http://localhost:5174']);
  });

  it('reports invalid variables by name without echoing values', () => {
    const secret = 'not-a-url-but-a-secret';
    expect(() =>
      parseEnv(baseEnv, { DATABASE_URL: secret, OIDC_ISSUER: 'http://kc/realms/a' }),
    ).toThrow(/DATABASE_URL/);
    expect(() =>
      parseEnv(baseEnv, { DATABASE_URL: secret, OIDC_ISSUER: 'http://kc/realms/a' }),
    ).not.toThrow(new RegExp(secret));
  });
});
