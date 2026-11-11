import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  assertValidEvent,
  assertValidPayload,
  EVENT_TYPES,
  InvalidEventError,
  PII_KEYS,
  PiiInPayloadError,
} from '../src/index.js';

const dir = fileURLToPath(new URL('../../../contracts/events/', import.meta.url));
const files = readdirSync(dir).filter((f) => f.endsWith('.schema.json'));
const schemas = files.map(
  (f) => [f, JSON.parse(readFileSync(`${dir}${f}`, 'utf8')) as Record<string, unknown>] as const,
);

/** All property names declared anywhere in a JSON schema. */
function propertyNames(node: unknown): string[] {
  if (Array.isArray(node)) return node.flatMap(propertyNames);
  if (node === null || typeof node !== 'object') return [];
  const obj = node as Record<string, unknown>;
  const own =
    obj.properties && typeof obj.properties === 'object' ? Object.keys(obj.properties) : [];
  return [...own, ...Object.values(obj).flatMap(propertyNames)];
}

describe('event contracts (contracts/events)', () => {
  it('has exactly one v1 schema per event type', () => {
    expect(files.sort()).toEqual(EVENT_TYPES.map((t) => `${t}.v1.schema.json`).sort());
  });

  it.each(schemas)('%s declares no personal-data field', (_file, schema) => {
    const leaked = propertyNames(schema).filter((k) => PII_KEYS.has(k.toLowerCase()));
    expect(leaked).toEqual([]);
  });

  it('every schema shares the same envelope', () => {
    const envelopes = schemas.map(([, s]) => {
      const { type: _type, payload: _payload, ...rest } = s.properties as Record<string, unknown>;
      return JSON.stringify({ required: s.required, rest });
    });
    expect(new Set(envelopes).size).toBe(1);
  });
});

describe('assertValidPayload', () => {
  const lotCree = {
    lot_id: '0b5e7b4e-6a3b-4f0e-9a51-3f3c1d6f2a10',
    produit_id: '6f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f',
    numero: 'HVE-1L-2026-001',
    date_fabrication: '2026-11-01',
    date_peremption: '2028-04-24',
    quantite_initiale: 120,
    niveau_qr: 'lot' as const,
  };

  it('accepts a conforming payload', () => {
    expect(() => assertValidPayload('lot_cree', lotCree)).not.toThrow();
  });

  it('rejects unknown fields, bad formats and wrong enums', () => {
    expect(() => assertValidPayload('lot_cree', { ...lotCree, extra: 1 } as never)).toThrow(
      InvalidEventError,
    );
    expect(() =>
      assertValidPayload('lot_cree', { ...lotCree, date_fabrication: '01/11/2026' }),
    ).toThrow(/date_fabrication/);
    expect(() => assertValidPayload('lot_cree', { ...lotCree, niveau_qr: 'box' } as never)).toThrow(
      InvalidEventError,
    );
  });

  it('rejects personal data before schema validation, without echoing it', () => {
    let caught: unknown;
    try {
      assertValidPayload('lot_cree', { ...lotCree, email: 'a@b.ma' } as never);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(PiiInPayloadError);
    expect((caught as Error).message).not.toContain('a@b.ma');
  });

  it('validates full envelopes as published', () => {
    const event = {
      event_id: '9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a',
      type: 'lot_cree' as const,
      version: 1,
      coop_id: '11111111-1111-4111-8111-111111111111',
      occurred_at: '2026-11-11T10:00:00.000Z',
      is_synthetic: false,
      payload: lotCree,
    };
    expect(() => assertValidEvent(event)).not.toThrow();
    expect(() => assertValidEvent({ ...event, version: 2 })).toThrow(InvalidEventError);
  });
});
