import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  assertValidEvent,
  assertValidPayload,
  EVENT_CONTRACT,
  EVENT_TYPES,
  InvalidEventError,
  PII_KEYS,
  PiiInPayloadError,
} from '../src/index.js';

/** The contract file itself (shared with the data plane), not the embedded copy. */
const contract = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../../../contracts/events/evenements.schema.json', import.meta.url)),
    'utf8',
  ),
) as { properties: { type: { enum: string[] } }; $defs: Record<string, unknown> };

/** All property names declared anywhere in a JSON schema. */
function propertyNames(node: unknown): string[] {
  if (Array.isArray(node)) return node.flatMap(propertyNames);
  if (node === null || typeof node !== 'object') return [];
  const obj = node as Record<string, unknown>;
  const own =
    obj.properties && typeof obj.properties === 'object' ? Object.keys(obj.properties) : [];
  return [...own, ...Object.values(obj).flatMap(propertyNames)];
}

const COOP = '11111111-1111-4111-8111-111111111111';
const PRODUIT = '6f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f';
const LOT = '0b5e7b4e-6a3b-4f0e-9a51-3f3c1d6f2a10';

const commande = {
  commande_id: '9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a',
  client_id: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  type_client: 'particulier' as const,
  ville: 'Fès',
  canal: 'web' as const,
  date_commande: '2026-11-11T10:00:00.000Z',
  lignes: [
    {
      produit_id: PRODUIT,
      code_produit: 'HVE-1L',
      lot_id: LOT,
      quantite: 2,
      prix_unitaire_mad: 75.5,
    },
  ] as [
    {
      produit_id: string;
      code_produit: string;
      lot_id: string;
      quantite: number;
      prix_unitaire_mad: number;
    },
  ],
};

const stock = {
  mouvement_id: '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e',
  lot_id: LOT,
  produit_id: PRODUIT,
  code_produit: 'HVE-1L',
  type_mouvement: 'sortie' as const,
  quantite: 2,
  date_mouvement: '2026-11-11T10:00:00.000Z',
};

const scan = {
  scan_id: '3c4d5e6f-7a8b-4c9d-8e1f-2a3b4c5d6e7f',
  qr_id: '4d5e6f7a-8b9c-4d0e-9f2a-3b4c5d6e7f8a',
  niveau: 'lot' as const,
  date_scan: '2026-11-11T10:00:00.000Z',
  ville: null,
  appareil: 'Android',
};

describe('shared event contract (contracts/events/evenements.schema.json)', () => {
  it('the apps handle exactly the event types of the contract', () => {
    expect([...EVENT_TYPES].sort()).toEqual([...contract.properties.type.enum].sort());
    expect(Object.keys(contract.$defs).sort()).toEqual([...EVENT_TYPES].sort());
  });

  it('the embedded copy is the contract file', () => {
    expect(EVENT_CONTRACT).toEqual(contract);
  });

  it('declares no personal-data field', () => {
    expect(propertyNames(contract).filter((k) => PII_KEYS.has(k.toLowerCase()))).toEqual([]);
  });
});

describe('assertValidPayload', () => {
  it.each([
    ['commande_creee', commande],
    ['stock_modifie', stock],
    ['qr_scanne', scan],
  ] as const)('accepts a conforming %s payload', (type, payload) => {
    expect(() => assertValidPayload(type, payload)).not.toThrow();
  });

  it('rejects unknown fields, bad formats and wrong enums', () => {
    expect(() =>
      assertValidPayload('stock_modifie', { ...stock, stock_apres: 3 } as never),
    ).toThrow(InvalidEventError);
    expect(() =>
      assertValidPayload('stock_modifie', { ...stock, date_mouvement: '11/11/2026' }),
    ).toThrow(/date_mouvement/);
    expect(() =>
      assertValidPayload('stock_modifie', { ...stock, type_mouvement: 'vol' } as never),
    ).toThrow(InvalidEventError);
    expect(() =>
      assertValidPayload('commande_creee', { ...commande, lignes: [] } as never),
    ).toThrow(InvalidEventError);
  });

  it('rejects personal data before schema validation, without echoing it', () => {
    let caught: unknown;
    try {
      assertValidPayload('qr_scanne', { ...scan, telephone: '0600000000' } as never);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(PiiInPayloadError);
    expect((caught as Error).message).not.toContain('0600000000');
  });
});

describe('assertValidEvent', () => {
  const event = {
    event_id: '9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6b',
    coop_id: COOP,
    type: 'stock_modifie',
    version: 1,
    occurred_at: '2026-11-11T10:00:00.000Z',
    payload: stock,
  };

  it('validates full envelopes as published', () => {
    expect(() => assertValidEvent(event)).not.toThrow();
  });

  it('rejects another version, an extra envelope field, an unknown type or a wrong payload', () => {
    expect(() => assertValidEvent({ ...event, version: 2 })).toThrow(InvalidEventError);
    expect(() => assertValidEvent({ ...event, is_synthetic: false })).toThrow(InvalidEventError);
    expect(() => assertValidEvent({ ...event, type: 'lot_cree' })).toThrow(InvalidEventError);
    expect(() => assertValidEvent({ ...event, type: 'qr_scanne' })).toThrow(InvalidEventError);
  });
});
