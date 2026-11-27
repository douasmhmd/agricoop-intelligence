import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { type AuthUser, toAuthUser } from './auth-user.js';

/** Verifies a bearer token and returns the caller. Throws on any invalid token. */
export interface JwtVerifier {
  verify(token: string): Promise<AuthUser>;
}

export const JWT_VERIFIER = Symbol.for('agricoop.JWT_VERIFIER');

export interface OidcOptions {
  /** e.g. http://localhost:8080/realms/agricoop — must equal the token `iss`. */
  issuer: string;
  /** Expected `aud` (the agricoop-api client). */
  audience: string;
  /** JWKS endpoint; defaults to the Keycloak certs URL under the issuer. Lets containers fetch keys
   *  on an internal hostname while tokens carry the browser-facing issuer. */
  jwksUrl?: string;
}

/** Verifier backed by a JWKS (remote in production, local in tests). RS256 only, 30 s clock skew. */
export function createJwtVerifier(options: OidcOptions, keys?: JWTVerifyGetKey): JwtVerifier {
  const jwks =
    keys ??
    createRemoteJWKSet(
      new URL(options.jwksUrl ?? `${options.issuer}/protocol/openid-connect/certs`),
      { cooldownDuration: 30_000, cacheMaxAge: 10 * 60_000 },
    );
  return {
    async verify(token: string): Promise<AuthUser> {
      const { payload } = await jwtVerify(token, jwks, {
        issuer: options.issuer,
        audience: options.audience,
        algorithms: ['RS256'],
        clockTolerance: 30,
        requiredClaims: ['sub', 'exp'],
      });
      return toAuthUser(payload);
    },
  };
}
