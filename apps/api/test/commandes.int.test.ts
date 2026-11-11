/*
 * Orders, payments and the status machine — integration tests (with and without RLS).
 * Business "today" is pinned to 2026-11-11.
 */
import { findPiiKeys } from '@agricoop/events';
import {
  createTestIssuer,
  ownerQuery,
  startTestDatabase,
  type TestDatabase,
  type TestIssuer,
} from '@agricoop/testing';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { InMemoryNotificationProvider } from '../src/notifications/notifications';
import { CmiMockGateway } from '../src/paiements/payment-gateway';
import { createTestApp } from './support/test-app';

const COOP_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const COOP_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const clock = { now: () => new Date('2026-11-11T12:00:00Z') };
const gateway = new CmiMockGateway('dev-only-payment-mock-secret');

const alicePii = {
  nom: 'Alice Benali',
  telephone: '+212 600 000 001',
  adresse: '12 rue des Oliviers, Agdal',
  ville: 'Rabat',
};

describe.each([{ rls: false }, { rls: true }])('orders (rls: $rls)', ({ rls }) => {
  let db: TestDatabase;
  let issuer: TestIssuer;
  let app: NestFastifyApplication;
  const notifications = new InMemoryNotificationProvider();
  const t: Record<string, string> = {};
  const id: Record<string, string> = {};

  const api = () => request(app.getHttpServer());
  const as = (who: string) => ({ authorization: `Bearer ${t[who]}` });
  const customer = (sub: string, email: string, verified = true, roles = ['customer']) =>
    issuer.sign({ sub, roles, extra: { email, email_verified: verified } });
  const order = (who: string, lignes: { produit_id: string; quantite: number }[], code = 'COOPA') =>
    api()
      .post(`/api/v1/coops/${code}/commandes`)
      .set(as(who))
      .send({ lignes, coordonnees: alicePii });
  const count = async (sql: string) => (await ownerQuery<{ n: number }>(db, sql))[0]!.n;

  async function produit(body: Record<string, unknown>): Promise<string> {
    const res = await api()
      .post('/api/v1/produits')
      .set(as('manager'))
      .send({
        famille: 'alimentaire',
        categorie: 'huile',
        cout_mad: '10',
        conservation_j: 540,
        niveau_qr: 'lot',
        ...body,
      })
      .expect(201);
    return res.body.produit_id as string;
  }
  async function lot(produitId: string, numero: string, qty: number, fab: string, per: string) {
    const res = await api()
      .post('/api/v1/lots')
      .set(as('manager'))
      .send({
        produit_id: produitId,
        numero,
        date_fabrication: fab,
        date_peremption: per,
        quantite_initiale: qty,
      })
      .expect(201);
    return res.body.lot_id as string;
  }
  const stockOf = async (lotId: string) =>
    (await api().get(`/api/v1/lots/${lotId}`).set(as('manager')).expect(200)).body.stock as number;

  beforeAll(async () => {
    [db, issuer] = await Promise.all([startTestDatabase({ rls }), createTestIssuer()]);
    await ownerQuery(
      db,
      `INSERT INTO cooperative (coop_id, code, nom, province) VALUES
         ($1, 'COOPA', 'Coopérative A', 'Ouezzane'), ($2, 'COOPB', 'Coopérative B', 'Taounate')`,
      [COOP_A, COOP_B],
    );
    app = await createTestApp(db, issuer, { clock, notifications });
    t.manager = await issuer.sign({ roles: ['coop_manager'], tenantId: COOP_A });
    t.alice = await customer('alice', 'alice@example.ma');
    t.bob = await customer('bob', 'bob@example.ma');
    t.rita = await customer('rita', 'rita@example.ma', true, ['customer', 'reseller']);
    t.ursula = await customer('ursula', 'ursula@example.ma', false);

    id.huile = await produit({ code: 'HVE-1L', nom: 'Huile 1 L', prix_mad: '75' });
    id.savon = await produit({
      code: 'SAV-100',
      nom: 'Savon',
      prix_mad: '25',
      famille: 'cosmetique',
      categorie: 'savon',
    });
    id.inactif = await produit({ code: 'OLD-1', nom: 'Ancien', prix_mad: '10', actif: false });
    id.expired = await lot(id.huile, 'HVE-OLD', 50, '2025-01-01', '2026-11-10');
    id.l1 = await lot(id.huile, 'HVE-1', 3, '2026-01-01', '2027-01-01');
    id.l2 = await lot(id.huile, 'HVE-2', 10, '2026-06-01', '2027-06-01');
    id.l3 = await lot(id.savon, 'SAV-1', 5, '2026-06-01', '2028-06-01');
  });

  afterAll(async () => {
    await app?.close();
    await db?.stop();
  });

  describe('storefront catalogue', () => {
    it('lists cooperatives and active products with orderable (non-expired) stock, without auth', async () => {
      const coops = await api().get('/api/v1/coops').expect(200);
      expect((coops.body as { code: string }[]).map((c) => c.code)).toEqual(['COOPA', 'COOPB']);
      const res = await api().get('/api/v1/coops/COOPA/produits').expect(200);
      expect(res.body).toEqual([
        expect.objectContaining({ code: 'HVE-1L', prix_mad: '75.00', disponible: 13 }),
        expect.objectContaining({ code: 'SAV-100', disponible: 5 }),
      ]);
      expect(res.body[0]).not.toHaveProperty('cout_mad');
      await api().get('/api/v1/coops/NOPE/produits').expect(404);
    });
  });

  describe('placing orders', () => {
    it('allocates FEFO across lots, skipping expired ones, in one transaction', async () => {
      const res = await order('alice', [
        { produit_id: id.huile!, quantite: 5 },
        { produit_id: id.savon!, quantite: 2 },
      ]).expect(201);
      id.order1 = res.body.commande_id as string;
      expect(res.body).toMatchObject({
        statut: 'creee',
        canal: 'web',
        montant_total_mad: '425.00',
      });
      expect(res.body.paiement.redirect_url).toBe(
        `/api/v1/coops/COOPA/paiements/mock/${id.order1}`,
      );
      expect(
        (res.body.lignes as { lot_numero: string; quantite: number; montant_mad: string }[]).map(
          (l) => `${l.lot_numero}:${l.quantite}:${l.montant_mad}`,
        ),
      ).toEqual(['HVE-1:3:225.00', 'HVE-2:2:150.00', 'SAV-1:2:50.00']);
      expect([await stockOf(id.l1!), await stockOf(id.l2!), await stockOf(id.expired!)]).toEqual([
        0, 8, 50,
      ]);

      const events = await ownerQuery<{ type: string; payload: Record<string, unknown> }>(
        db,
        `SELECT type, payload FROM outbox WHERE payload->>'commande_id' = $1 ORDER BY created_at`,
        [id.order1],
      );
      expect(events.map((e) => e.type)).toEqual([
        'commande_creee',
        'stock_modifie',
        'stock_modifie',
        'stock_modifie',
      ]);
      expect(events.slice(1).map((e) => e.payload.stock_apres)).toEqual([0, 8, 3]);
      expect(events[0]?.payload).toMatchObject({
        type_client: 'particulier',
        ville: 'Rabat',
        canal: 'web',
      });
    });

    it('never puts personal data in events', async () => {
      const rows = await ownerQuery<{ payload: unknown }>(db, 'SELECT payload FROM outbox');
      const all = JSON.stringify(rows);
      for (const value of [
        alicePii.nom,
        alicePii.telephone,
        alicePii.adresse,
        'alice@example.ma',
      ]) {
        expect(all).not.toContain(value);
      }
      for (const r of rows) expect(findPiiKeys(r.payload)).toEqual([]);
    });

    it('rejects an order that does not fit, and writes nothing', async () => {
      const before = await count(
        `SELECT ((SELECT count(*) FROM commande) + (SELECT count(*) FROM mouvement_stock) + (SELECT count(*) FROM outbox))::int AS n`,
      );
      const res = await order('alice', [{ produit_id: id.huile!, quantite: 100 }]).expect(409);
      expect(res.body).toMatchObject({
        code: 'stock_insuffisant',
        manquants: [{ produit_id: id.huile, demande: 100, disponible: 8 }],
      });
      const after = await count(
        `SELECT ((SELECT count(*) FROM commande) + (SELECT count(*) FROM mouvement_stock) + (SELECT count(*) FROM outbox))::int AS n`,
      );
      expect(after).toBe(before);
    });

    it('rejects inactive, foreign and unknown products', async () => {
      expect(
        (await order('alice', [{ produit_id: id.inactif!, quantite: 1 }]).expect(409)).body.code,
      ).toBe('produit_inactif');
      // A product of COOPA ordered through COOPB's storefront does not exist there.
      await order('alice', [{ produit_id: id.huile!, quantite: 1 }], 'COOPB').expect(404);
    });

    it('records resellers with canal and type_client revendeur', async () => {
      const res = await order('rita', [{ produit_id: id.savon!, quantite: 1 }]).expect(201);
      expect(res.body.canal).toBe('revendeur');
      const [c] = await ownerQuery<{ type_client: string }>(
        db,
        'SELECT type_client FROM client WHERE client_id = $1',
        [res.body.client_id],
      );
      expect(c?.type_client).toBe('revendeur');
    });

    it('requires a verified e-mail to link the account', async () => {
      expect(
        (await order('ursula', [{ produit_id: id.savon!, quantite: 1 }]).expect(403)).body.code,
      ).toBe('email_non_verifie');
    });

    it('reuses the same client for later orders and keeps orders private', async () => {
      const second = await order('alice', [{ produit_id: id.huile!, quantite: 1 }]).expect(201);
      id.order2 = second.body.commande_id as string;
      expect(
        await count(`SELECT count(*)::int AS n FROM client_pii WHERE email = 'alice@example.ma'`),
      ).toBe(1);

      const mine = await api().get('/api/v1/coops/COOPA/commandes').set(as('alice')).expect(200);
      expect((mine.body as { commande_id: string }[]).map((c) => c.commande_id).sort()).toEqual(
        [id.order1, id.order2].sort(),
      );
      expect(
        (await api().get('/api/v1/coops/COOPA/commandes').set(as('bob')).expect(200)).body,
      ).toEqual([]);
      await api().get(`/api/v1/coops/COOPA/commandes/${id.order1}`).set(as('bob')).expect(404);
    });

    it('shows managers all orders with totals, and the delivery details on the detail view', async () => {
      const page = await api().get('/api/v1/commandes').set(as('manager')).expect(200);
      expect(page.body.total).toBe(3);
      const first = (
        page.body.items as { commande_id: string; montant_total_mad: string; nb_lignes: number }[]
      ).find((c) => c.commande_id === id.order1);
      expect(first).toMatchObject({ montant_total_mad: '425.00', nb_lignes: 3, ville: 'Rabat' });
      const detail = await api()
        .get(`/api/v1/commandes/${id.order1}`)
        .set(as('manager'))
        .expect(200);
      expect(detail.body.client).toMatchObject({
        nom: 'Alice Benali',
        email: 'alice@example.ma',
        ville: 'Rabat',
      });
    });
  });

  describe('payment (CMI-style mock)', () => {
    const callback = (fields: Record<string, string>) =>
      api().post('/api/v1/coops/COOPA/paiements/cmi/callback').type('form').send(fields);

    it('serves the mock gateway page', async () => {
      const res = await api().get(`/api/v1/coops/COOPA/paiements/mock/${id.order1}`).expect(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.text).toContain('425,00 MAD');
    });

    it('rejects a forged callback', async () => {
      const fields = gateway.buildCallback('COOPA', id.order1!, '425.00', true);
      const res = await callback({ ...fields, HASH: 'forged' }).expect(400);
      expect(res.body.code).toBe('signature_invalide');
      // A valid signature for another cooperative's store key does not work either.
      await callback(gateway.buildCallback('COOPB', id.order1!, '425.00', true)).expect(400);
    });

    it('rejects an amount that differs from the order total', async () => {
      const res = await callback(gateway.buildCallback('COOPA', id.order1!, '1.00', true)).expect(
        409,
      );
      expect(res.body.code).toBe('montant_incorrect');
    });

    it('marks the order paid exactly once, emits the event and notifies the customer', async () => {
      const fields = gateway.buildCallback('COOPA', id.order1!, '425.00', true);
      expect((await callback(fields).expect(200)).text).toBe('ACTION=POSTAUTH');
      expect((await callback(fields).expect(200)).text).toBe('ACTION=POSTAUTH'); // replay
      const detail = await api()
        .get(`/api/v1/commandes/${id.order1}`)
        .set(as('manager'))
        .expect(200);
      expect(detail.body.statut).toBe('payee');
      expect(
        await count(
          `SELECT count(*)::int AS n FROM outbox WHERE type = 'commande_statut_modifie' AND payload->>'commande_id' = '${id.order1}'`,
        ),
      ).toBe(1);
      await new Promise((r) => setTimeout(r, 200)); // notification is sent after commit
      expect(notifications.sent.map((n) => `${n.channel}:${n.to}`)).toEqual([
        'email:alice@example.ma',
        `sms:${alicePii.telephone}`,
      ]);
    });

    it('lets the mock page decide and redirects back to the storefront', async () => {
      const res = await api()
        .post(`/api/v1/coops/COOPA/paiements/mock/${id.order2}/decision`)
        .type('form')
        .send({ decision: 'decline' })
        .expect(303);
      expect(res.headers.location).toBe(`/coops/COOPA/commandes/${id.order2}?paiement=refuse`);
      expect(
        (await api().get(`/api/v1/commandes/${id.order2}`).set(as('manager'))).body.statut,
      ).toBe('creee');
    });
  });

  describe('status machine', () => {
    const setStatut = (commandeId: string, statut: string) =>
      api().post(`/api/v1/commandes/${commandeId}/statut`).set(as('manager')).send({ statut });

    it('follows payee → expediee → livree and refuses anything else', async () => {
      await setStatut(id.order1!, 'expediee').expect(200);
      await setStatut(id.order1!, 'livree').expect(200);
      const res = await setStatut(id.order1!, 'annulee').expect(409);
      expect(res.body).toMatchObject({
        code: 'transition_invalide',
        de: 'livree',
        vers: 'annulee',
      });
      await setStatut(id.order2!, 'expediee').expect(409); // creee → expediee skips payment
    });

    it('cancellation restocks the lots once, with compensating events', async () => {
      const before = await stockOf(id.l2!);
      const res = await api()
        .post(`/api/v1/coops/COOPA/commandes/${id.order2}/annulation`)
        .set(as('alice'))
        .expect(200);
      expect(res.body.statut).toBe('annulee');
      expect(await stockOf(id.l2!)).toBe(before + 1);
      // Cancelling again is a no-op: no double restock.
      await api()
        .post(`/api/v1/coops/COOPA/commandes/${id.order2}/annulation`)
        .set(as('alice'))
        .expect(200);
      expect(await stockOf(id.l2!)).toBe(before + 1);
      expect(
        await count(
          `SELECT count(*)::int AS n FROM outbox WHERE type = 'stock_modifie' AND payload->>'motif' = 'annulation_commande' AND payload->>'commande_id' = '${id.order2}'`,
        ),
      ).toBe(1);
      // Someone else's order cannot be cancelled.
      await api()
        .post(`/api/v1/coops/COOPA/commandes/${id.order1}/annulation`)
        .set(as('bob'))
        .expect(404);
    });
  });

  describe('concurrency', () => {
    it('never oversells: 15 parallel orders for a lot of 10', async () => {
      const p = await produit({ code: 'RUSH-1', nom: 'Rush', prix_mad: '5' });
      const l = await lot(p, 'RUSH-LOT', 10, '2026-06-01', '2027-06-01');
      const tokens = await Promise.all(
        Array.from({ length: 15 }, (_, i) => customer(`buyer-${i}`, `buyer${i}@example.ma`)),
      );
      const results = await Promise.all(
        tokens.map((tok) =>
          api()
            .post('/api/v1/coops/COOPA/commandes')
            .set({ authorization: `Bearer ${tok}` })
            .send({ lignes: [{ produit_id: p, quantite: 1 }], coordonnees: alicePii }),
        ),
      );
      const statuses = results.map((r) => r.status);
      expect(statuses.filter((s) => s === 201)).toHaveLength(10);
      expect(statuses.filter((s) => s === 409)).toHaveLength(5);
      expect(await stockOf(l)).toBe(0);
    });

    it('does not deadlock when orders lock overlapping lots in opposite line order', async () => {
      const p1 = await produit({ code: 'DL-1', nom: 'DL 1', prix_mad: '5' });
      const p2 = await produit({ code: 'DL-2', nom: 'DL 2', prix_mad: '5' });
      await lot(p1, 'DL-1-LOT', 50, '2026-06-01', '2027-03-01');
      await lot(p2, 'DL-2-LOT', 50, '2026-06-01', '2027-02-01');
      const results = await Promise.all(
        Array.from({ length: 20 }, (_, i) =>
          order(
            'alice',
            i % 2
              ? [
                  { produit_id: p1, quantite: 1 },
                  { produit_id: p2, quantite: 1 },
                ]
              : [
                  { produit_id: p2, quantite: 1 },
                  { produit_id: p1, quantite: 1 },
                ],
          ),
        ),
      );
      expect(results.map((r) => r.status)).toEqual(Array(20).fill(201));
    });
  });
});
