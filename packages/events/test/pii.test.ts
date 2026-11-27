import { describe, expect, it } from 'vitest';
import { assertNoPii, EVENT_TOPIC, findPiiKeys, PiiInPayloadError } from '../src/index.js';

describe('PII guard', () => {
  it('accepts a payload with IDs, city and amounts', () => {
    expect(() =>
      assertNoPii({
        commande_id: 'c1',
        client_id: 'k1',
        type_client: 'particulier',
        ville: 'Rabat',
        lignes: [{ produit_id: 'p1', lot_id: 'l1', quantite: 2, prix_unitaire_mad: '75.00' }],
      }),
    ).not.toThrow();
  });

  it('finds client_pii keys at any depth, case-insensitively', () => {
    expect(
      findPiiKeys({ client: { Email: 'x', adresse: 'y' }, lignes: [{ telephone: '0' }] }),
    ).toEqual(['$.client.Email', '$.client.adresse', '$.lignes[0].telephone']);
  });

  it('reports paths but never values', () => {
    let caught: unknown;
    try {
      assertNoPii({ nom: 'Fatima Benali' });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(PiiInPayloadError);
    expect((caught as Error).message).toContain('$.nom');
    expect((caught as Error).message).not.toContain('Fatima');
  });
});

describe('EVENT_TOPIC', () => {
  it('is the topic the data plane consumes', () => {
    expect(EVENT_TOPIC).toBe('agricoop.events');
  });
});
