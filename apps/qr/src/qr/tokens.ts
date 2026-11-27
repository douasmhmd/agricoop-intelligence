import { createHash, randomBytes } from 'node:crypto';

/*
 * QR authenticity tokens. 128 random bits, base64url WITHOUT padding (22 chars). Only
 * hex(sha256(utf8(token))) is stored (qr_code.token_hash) — the same convention as the synthetic
 * generator. The clear token exists only in the label output.
 */

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{22}$/;

export function generateQrToken(): string {
  return randomBytes(16).toString('base64url');
}

export function hashQrToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Cheap shape check before touching the database. */
export function isWellFormedQrToken(token: string): boolean {
  return TOKEN_PATTERN.test(token);
}
