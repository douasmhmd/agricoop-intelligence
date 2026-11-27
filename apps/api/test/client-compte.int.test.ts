/*
 * Storefront account linking once schema proposal 003 (client_compte) is merged: the service
 * detects the table and links on the Keycloak `sub` instead of the e-mail.
 */
import { readFileSync } from 'node:fs';
import {
  createTestIssuer,
  ownerQuery,
  proposalPath,
  startTestDatabase,
  type TestDatabase,
  type TestIssuer,
} from '@agricoop/testing';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ClientsService } from '../src/clients/clients.service';
import { InMemoryNotificationProvider } from '../src/notifications/notifications';
import { createTestApp } from './support/test-app';

const COOP_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PROPOSAL_003 = proposalPath('003_client_compte.sql');

describe('client linking with proposal 003 (client_compte)', () => {
  let db: TestDatabase;
  let issuer: TestIssuer;
  let app: NestFastifyApplication;
  let produitId: string;

  beforeAll(async () => {
    [db, issuer] = await Promise.all([startTestDatabase(), createTestIssuer()]);
    await ownerQuery(db, readFileSync(PROPOSAL_003, 'utf8'));
    await ownerQuery(
      db,
      `INSERT INTO cooperative (coop_id, code, nom, province) VALUES ($1, 'COOPA', 'A', 'Ouezzane')`,
      [COOP_A],
    );
    app = await createTestApp(db, issuer, { notifications: new InMemoryNotificationProvider() });
    const manager = await issuer.sign({ roles: ['coop_manager'], tenantId: COOP_A });
    const p = await request(app.getHttpServer())
      .post('/api/v1/produits')
      .set({ authorization: `Bearer ${manager}` })
      .send({
        code: 'SAV-1',
        nom: 'Savon',
        famille: 'cosmetique',
        categorie: 'savon',
        prix_mad: '25',
        cout_mad: '9',
        conservation_j: 730,
        niveau_qr: 'lot',
      })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/v1/lots')
      .set({ authorization: `Bearer ${manager}` })
      .send({
        produit_id: p.body.produit_id,
        numero: 'S-1',
        date_fabrication: '2026-01-01',
        quantite_initiale: 10,
      })
      .expect(201);
    produitId = p.body.produit_id as string;
  });

  afterAll(async () => {
    await app?.close();
    await db?.stop();
  });

  it('detects the table and links on sub (no verified e-mail needed)', async () => {
    expect(await app.get(ClientsService).linkMode()).toBe('client_compte');
    const token = await issuer.sign({ sub: 'kc-user-42', roles: ['customer'] });
    const place = () =>
      request(app.getHttpServer())
        .post('/api/v1/coops/COOPA/commandes')
        .set({ authorization: `Bearer ${token}` })
        .send({
          lignes: [{ produit_id: produitId, quantite: 1 }],
          coordonnees: { nom: 'Client Test', adresse: '1 avenue Hassan II', ville: 'Fès' },
        })
        .expect(201);
    const first = await place();
    const second = await place();
    expect(second.body.client_id).toBe(first.body.client_id);
    const rows = await ownerQuery<{ idp_subject: string; coop_id: string }>(
      db,
      'SELECT idp_subject, coop_id FROM client_compte',
    );
    expect(rows).toEqual([{ idp_subject: 'kc-user-42', coop_id: COOP_A }]);
  });
});
