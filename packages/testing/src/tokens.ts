import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  type JWTVerifyGetKey,
  SignJWT,
  type CryptoKey,
} from 'jose';

export const TEST_ISSUER = 'http://keycloak.test/realms/agricoop';
export const TEST_AUDIENCE = 'agricoop-api';

export interface TestTokenClaims {
  sub?: string;
  roles?: string[];
  tenantId?: string;
  audience?: string;
  issuer?: string;
  /** Seconds from now; negative for an expired token. */
  expiresIn?: number;
}

export interface TestIssuer {
  issuer: string;
  audience: string;
  /** Pass to createJwtVerifier(options, jwks). */
  jwks: JWTVerifyGetKey;
  sign(claims?: TestTokenClaims): Promise<string>;
  /** A token signed by a different key (must be rejected). */
  signWithForeignKey(claims?: TestTokenClaims): Promise<string>;
}

async function sign(key: CryptoKey, kid: string, c: TestTokenClaims): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const jwt = new SignJWT({
    realm_access: { roles: c.roles ?? [] },
    ...(c.tenantId ? { tenant_id: c.tenantId } : {}),
  })
    .setProtectedHeader({ alg: 'RS256', kid })
    .setSubject(c.sub ?? 'test-user')
    .setIssuer(c.issuer ?? TEST_ISSUER)
    .setAudience(c.audience ?? TEST_AUDIENCE)
    .setIssuedAt(now - 5)
    .setExpirationTime(now + (c.expiresIn ?? 300));
  return jwt.sign(key);
}

/** An in-memory Keycloak stand-in: RS256 key pair + local JWKS. */
export async function createTestIssuer(): Promise<TestIssuer> {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const foreign = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'test-key', alg: 'RS256', use: 'sig' };
  return {
    issuer: TEST_ISSUER,
    audience: TEST_AUDIENCE,
    jwks: createLocalJWKSet({ keys: [jwk] }),
    sign: (claims = {}) => sign(privateKey, 'test-key', claims),
    signWithForeignKey: (claims = {}) => sign(foreign.privateKey, 'test-key', claims),
  };
}
