import { describe, expect, it } from 'vitest';
import { evaluateScan } from '../src/qr/anomaly';
import { deviceClass, headerGeoLocator } from '../src/qr/client-info';
import { generateQrToken, hashQrToken, isWellFormedQrToken } from '../src/qr/tokens';

describe('QR tokens', () => {
  it('are 128-bit base64url without padding, hashed as hex sha256', () => {
    const token = generateQrToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(Buffer.from(token, 'base64url')).toHaveLength(16);
    expect(hashQrToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(isWellFormedQrToken(token)).toBe(true);
    expect(isWellFormedQrToken('../etc/passwd')).toBe(false);
  });

  it('hashes exactly like the synthetic generator (Python hashlib.sha256 of the ASCII token)', () => {
    // python -c "import hashlib; print(hashlib.sha256(b'AAAAAAAAAAAAAAAAAAAAAA').hexdigest())"
    expect(hashQrToken('AAAAAAAAAAAAAAAAAAAAAA')).toBe(
      '8a5bdb4cc15164126c6ef2668de9dd240d299ce6397a42c95a9411b93d080ed8',
    );
  });

  it('never repeats', () => {
    const tokens = new Set(Array.from({ length: 1000 }, generateQrToken));
    expect(tokens.size).toBe(1000);
  });
});

describe('evaluateScan', () => {
  const base = {
    niveau: 'unite' as const,
    statut: 'actif' as const,
    expired: false,
    nbScans: 1,
    villes24h: 1,
    quantiteInitiale: 1,
  };

  it('is authentic for a first scan of an active, valid code', () => {
    expect(evaluateScan(base)).toEqual([]);
  });

  it('flags inactive codes and expired lots', () => {
    expect(evaluateScan({ ...base, statut: 'desactive', expired: true })).toEqual([
      'qr_inactif',
      'lot_perime',
    ]);
    expect(evaluateScan({ ...base, statut: 'signale' })).toEqual(['qr_inactif']);
  });

  it('flags unit codes scanned too often or in more than 2 cities within 24 h', () => {
    expect(evaluateScan({ ...base, nbScans: 5, villes24h: 2 })).toEqual([]);
    expect(evaluateScan({ ...base, nbScans: 6 })).toEqual(['scans_multiples']);
    expect(evaluateScan({ ...base, villes24h: 3 })).toEqual(['villes_multiples']);
  });

  it('tolerates many buyers scanning a lot-level code, relative to the lot size', () => {
    const lot = { ...base, niveau: 'lot' as const, quantiteInitiale: 120 };
    expect(evaluateScan({ ...lot, nbScans: 200, villes24h: 9 })).toEqual([]);
    expect(evaluateScan({ ...lot, nbScans: 241 })).toEqual(['scans_multiples']);
  });
});

describe('client info', () => {
  it('classifies devices coarsely, like the synthetic data', () => {
    expect(deviceClass('Mozilla/5.0 (Linux; Android 15; Pixel 9)')).toBe('Android');
    expect(deviceClass('Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X)')).toBe('iPhone');
    expect(deviceClass('Mozilla/5.0 (Windows NT 10.0)')).toBe('Autre');
    expect(deviceClass(undefined)).toBe('Autre');
  });

  it('reads the city from trusted headers only and normalizes it', () => {
    expect(headerGeoLocator.city({ 'x-agricoop-city': '  casablanca ' }, '1.2.3.4')).toBe(
      'Casablanca',
    );
    expect(headerGeoLocator.city({ 'cf-ipcity': 'F%C3%A8s' }, undefined)).toBe('Fès');
    expect(headerGeoLocator.city({ 'x-agricoop-city': '<script>' }, undefined)).toBeNull();
    expect(headerGeoLocator.city({}, '1.2.3.4')).toBeNull();
  });
});
