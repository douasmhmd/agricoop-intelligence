/*
 * Catalogue, lots and stock — integration tests against Postgres (with and without RLS).
 * Business "today" is pinned to 2026-11-11 (Africa/Casablanca).
 */
import { assertValidEvent, type EventType } from '@agricoop/events';
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
import { createTestApp } from './support/test-app';

const COOP_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const COOP_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const TODAY = '2026-11-11';
const clock = { now: () => new Date(`${TODAY}T12:00:00Z`) };

const huile = {
  code: 'HVE-1L',
  nom: "Huile d'olive vierge extra 1 L",
  famille: 'alimentaire',
  categorie: 'huile',
  prix_mad: '75',
  cout_mad: '41.25',
  conservation_j: 540,
  huile_ml_par_unite: 1000,
  niveau_qr: 'lot',
};
const bidon = {
  ...huile,
  code: 'HVE-5L',
  nom: 'Huile 5 L',
  prix_mad: '340',
  cout_mad: '190',
  niveau_qr: 'unite',
};
const savon = {
  ...huile,
  code: 'SAV-100',
  nom: 'Savon 100 g',
  famille: 'cosmetique',
  categorie: 'savon',
  prix_mad: '25',
  cout_mad: '9',
  huile_ml_par_unite: 0,
  conservation_j: 730,
};

describe.each([{ rls: false }, { rls: true }])('catalogue & stock (rls: $rls)', ({ rls }) => {
  let db: TestDatabase;
  let issuer: TestIssuer;
  let app: NestFastifyApplication;
  let auth: { a: string; b: string };
  const ids: Record<string, string> = {};

  const api = () => request(app.getHttpServer());
  const asA = () => ({ authorization: `Bearer ${auth.a}` });
  const asB = () => ({ authorization: `Bearer ${auth.b}` });

  const createLot = (body: Record<string, unknown>, headers = asA()) =>
    api().post('/api/v1/lots').set(headers).send(body);

  beforeAll(async () => {
    [db, issuer] = await Promise.all([startTestDatabase({ rls }), createTestIssuer()]);
    await ownerQuery(
      db,
      `INSERT INTO cooperative (coop_id, code, nom, province) VALUES
         ($1, 'COOPA', 'A', 'Ouezzane'), ($2, 'COOPB', 'B', 'Taounate')`,
      [COOP_A, COOP_B],
    );
    app = await createTestApp(db, issuer, { clock });
    auth = {
      a: await issuer.sign({ roles: ['coop_manager'], tenantId: COOP_A }),
      b: await issuer.sign({ roles: ['coop_manager'], tenantId: COOP_B }),
    };
  });

  afterAll(async () => {
    await app?.close();
    await db?.stop();
  });

  describe('produits', () => {
    it('creates a product and computes its margin; money stays a string', async () => {
      const res = await api().post('/api/v1/produits').set(asA()).send(huile).expect(201);
      expect(res.body).toMatchObject({
        code: 'HVE-1L',
        prix_mad: '75.00',
        cout_mad: '41.25',
        marge_mad: '33.75',
        marge_pct: '45.0',
        actif: true,
        is_synthetic: false,
      });
      ids.huile = res.body.produit_id as string;
      ids.bidon = (await api().post('/api/v1/produits').set(asA()).send(bidon).expect(201)).body
        .produit_id as string;
      ids.savon = (await api().post('/api/v1/produits').set(asA()).send(savon).expect(201)).body
        .produit_id as string;
    });

    it('ignores a coop_id smuggled in the body', async () => {
      const res = await api()
        .post('/api/v1/produits')
        .set(asA())
        .send({ ...huile, code: 'SMUGGLE', coop_id: COOP_B })
        .expect(201);
      const [row] = await ownerQuery<{ coop_id: string }>(
        db,
        'SELECT coop_id FROM produit WHERE produit_id = $1',
        [res.body.produit_id],
      );
      expect(row?.coop_id).toBe(COOP_A);
      await api().delete(`/api/v1/produits/${res.body.produit_id}`).set(asA()).expect(204);
    });

    it('rejects a duplicate code with 409 but allows it in another cooperative', async () => {
      const dup = await api().post('/api/v1/produits').set(asA()).send(huile).expect(409);
      expect(dup.body.code).toBe('produit_code_existe');
      const other = await api().post('/api/v1/produits').set(asB()).send(huile).expect(201);
      ids.huileB = other.body.produit_id as string;
    });

    it('validates input with problem+json errors by field', async () => {
      const res = await api()
        .post('/api/v1/produits')
        .set(asA())
        .send({ ...huile, code: 'bad code', prix_mad: '0', conservation_j: 0, prix: 1 })
        .expect(400);
      expect(res.body.code).toBe('validation');
      expect((res.body.errors as { path: string }[]).map((e) => e.path).sort()).toEqual([
        'code',
        'conservation_j',
        'prix_mad',
      ]);
      await api().patch(`/api/v1/produits/${ids.huile}`).set(asA()).send({}).expect(400);
    });

    it('updates a product and recomputes the margin', async () => {
      const res = await api()
        .patch(`/api/v1/produits/${ids.savon}`)
        .set(asA())
        .send({ prix_mad: '30.00' })
        .expect(200);
      expect(res.body).toMatchObject({ prix_mad: '30.00', marge_mad: '21.00', marge_pct: '70.0' });
    });

    it('filters by famille, actif and synthetic', async () => {
      await ownerQuery(
        db,
        `INSERT INTO produit (coop_id, code, nom, famille, categorie, prix_mad, cout_mad,
                              conservation_j, niveau_qr, is_synthetic)
         VALUES ($1, 'SYN-1', 'Synthétique', 'coffret', 'coffret', 100, 50, 365, 'lot', true)`,
        [COOP_A],
      );
      const codes = async (qs: string) =>
        (
          (await api().get(`/api/v1/produits${qs}`).set(asA()).expect(200)).body as {
            code: string;
          }[]
        ).map((p) => p.code);
      expect(await codes('')).toEqual(['HVE-1L', 'HVE-5L', 'SAV-100', 'SYN-1']);
      expect(await codes('?synthetic=exclude')).toEqual(['HVE-1L', 'HVE-5L', 'SAV-100']);
      expect(await codes('?famille=cosmetique')).toEqual(['SAV-100']);
      expect(await codes('?actif=false')).toEqual([]);
    });

    it("hides another cooperative's products (404 on read, update and delete)", async () => {
      await api().get(`/api/v1/produits/${ids.huileB}`).set(asA()).expect(404);
      await api()
        .patch(`/api/v1/produits/${ids.huileB}`)
        .set(asA())
        .send({ nom: 'Huile B' })
        .expect(404);
      await api().delete(`/api/v1/produits/${ids.huileB}`).set(asA()).expect(404);
      await api().get(`/api/v1/produits/${ids.huileB}`).set(asB()).expect(200);
    });
  });

  describe('lots', () => {
    it('creates a lot with default expiry, initial entry and outbox events', async () => {
      const res = await createLot({
        produit_id: ids.huile,
        numero: 'HVE-1L-2026-001',
        date_fabrication: '2026-11-01',
        quantite_initiale: 120,
      }).expect(201);
      expect(res.body).toMatchObject({
        produit_code: 'HVE-1L',
        date_peremption: '2028-04-24', // 2026-11-01 + 540 days
        stock: 120,
        statut: 'disponible',
        niveau_qr: 'lot',
      });
      ids.lot1 = res.body.lot_id as string;

      const mouvements = await api()
        .get(`/api/v1/lots/${ids.lot1}/mouvements`)
        .set(asA())
        .expect(200);
      expect(mouvements.body).toMatchObject([{ type_mouvement: 'entree', quantite: 120 }]);
      const [unites] = await ownerQuery<{ n: number }>(
        db,
        'SELECT count(*)::int AS n FROM unite WHERE lot_id = $1',
        [ids.lot1],
      );
      expect(unites?.n).toBe(0);

      const events = await ownerQuery<{ type: string; payload: Record<string, unknown> }>(
        db,
        'SELECT type, payload FROM outbox WHERE coop_id = $1 ORDER BY created_at',
        [COOP_A],
      );
      expect(events.map((e) => e.type)).toEqual(['lot_cree', 'stock_modifie']);
      expect(events[1]?.payload).toMatchObject({
        lot_id: ids.lot1,
        type_mouvement: 'entree',
        stock_apres: 120,
        motif: 'creation_lot',
      });
    });

    it('creates serial units 1..N for unit-level QR products', async () => {
      const res = await createLot({
        produit_id: ids.bidon,
        numero: 'HVE-5L-2026-001',
        date_fabrication: '2026-10-15',
        date_peremption: '2028-01-15',
        quantite_initiale: 25,
      }).expect(201);
      const [u] = await ownerQuery<{ n: number; min: number; max: number }>(
        db,
        `SELECT count(*)::int AS n, min(numero_serie) AS min, max(numero_serie) AS max
           FROM unite WHERE lot_id = $1 AND coop_id = $2`,
        [res.body.lot_id, COOP_A],
      );
      expect(u).toEqual({ n: 25, min: 1, max: 25 });
    });

    it('rejects duplicates, bad dates, foreign and inactive products', async () => {
      const base = { produit_id: ids.huile, date_fabrication: '2026-11-01', quantite_initiale: 1 };
      expect((await createLot({ ...base, numero: 'HVE-1L-2026-001' }).expect(409)).body.code).toBe(
        'lot_numero_existe',
      );
      const dates = await createLot({
        ...base,
        numero: 'X-1',
        date_peremption: '2026-10-01',
      }).expect(400);
      expect(dates.body.errors).toMatchObject([{ path: 'date_peremption' }]);
      await createLot({ ...base, numero: 'X-2', produit_id: ids.huileB }).expect(404);
      await api().patch(`/api/v1/produits/${ids.savon}`).set(asA()).send({ actif: false });
      expect(
        (await createLot({ ...base, numero: 'X-3', produit_id: ids.savon }).expect(409)).body.code,
      ).toBe('produit_inactif');
      await api().patch(`/api/v1/produits/${ids.savon}`).set(asA()).send({ actif: true });
    });

    it('locks niveau_qr and blocks deletion once a product has lots', async () => {
      expect(
        (
          await api()
            .patch(`/api/v1/produits/${ids.huile}`)
            .set(asA())
            .send({ niveau_qr: 'unite' })
            .expect(409)
        ).body.code,
      ).toBe('niveau_qr_verrouille');
      expect(
        (await api().delete(`/api/v1/produits/${ids.huile}`).set(asA()).expect(409)).body.code,
      ).toBe('produit_utilise');
      // Without lots it is still free to change.
      await api()
        .patch(`/api/v1/produits/${ids.savon}`)
        .set(asA())
        .send({ niveau_qr: 'unite' })
        .expect(200);
      await api()
        .patch(`/api/v1/produits/${ids.savon}`)
        .set(asA())
        .send({ niveau_qr: 'lot' })
        .expect(200);
    });

    it("hides another cooperative's lots", async () => {
      const b = await createLot(
        {
          produit_id: ids.huileB,
          numero: 'B-001',
          date_fabrication: '2026-11-01',
          quantite_initiale: 5,
        },
        asB(),
      ).expect(201);
      await api().get(`/api/v1/lots/${b.body.lot_id}`).set(asA()).expect(404);
      await api().get(`/api/v1/lots/${b.body.lot_id}/mouvements`).set(asA()).expect(404);
      await api()
        .post(`/api/v1/lots/${b.body.lot_id}/pertes`)
        .set(asA())
        .send({ quantite: 1 })
        .expect(404);
      const pageA = await api().get('/api/v1/lots').set(asA()).expect(200);
      expect((pageA.body.items as { numero: string }[]).map((l) => l.numero)).not.toContain(
        'B-001',
      );
    });
  });

  describe('stock', () => {
    it('records losses and refuses to go below zero', async () => {
      const res = await api()
        .post(`/api/v1/lots/${ids.lot1}/pertes`)
        .set(asA())
        .send({ quantite: 20 })
        .expect(201);
      expect(res.body).toMatchObject({ stock_apres: 100, mouvement: { type_mouvement: 'perte' } });
      const over = await api()
        .post(`/api/v1/lots/${ids.lot1}/pertes`)
        .set(asA())
        .send({ quantite: 101 })
        .expect(409);
      expect(over.body.code).toBe('stock_insuffisant');
      expect((await api().get(`/api/v1/lots/${ids.lot1}`).set(asA())).body.stock).toBe(100);
    });

    it('serializes concurrent losses: stock never goes negative', async () => {
      const lotRes = await createLot({
        produit_id: ids.huile,
        numero: 'CONCURRENT-1',
        date_fabrication: '2026-11-01',
        quantite_initiale: 20,
      }).expect(201);
      const lotId = lotRes.body.lot_id as string;
      const results = await Promise.all(
        Array.from({ length: 10 }, () =>
          api().post(`/api/v1/lots/${lotId}/pertes`).set(asA()).send({ quantite: 3 }),
        ),
      );
      const statuses = results.map((r) => r.status).sort();
      expect(statuses.filter((s) => s === 201)).toHaveLength(6);
      expect(statuses.filter((s) => s === 409)).toHaveLength(4);
      const lot = await api().get(`/api/v1/lots/${lotId}`).set(asA()).expect(200);
      expect(lot.body.stock).toBe(2);
      const stockApres = results
        .filter((r) => r.status === 201)
        .map((r) => r.body.stock_apres as number)
        .sort((x, y) => y - x);
      expect(stockApres).toEqual([17, 14, 11, 8, 5, 2]);
    });

    it('lists lots with status filters and pagination', async () => {
      // Expired lot with stock, and an exhausted lot.
      await createLot({
        produit_id: ids.huile,
        numero: 'OLD-1',
        date_fabrication: '2025-01-01',
        date_peremption: '2026-11-11',
        quantite_initiale: 4,
      }).expect(201);
      const empty = await createLot({
        produit_id: ids.huile,
        numero: 'EMPTY-1',
        date_fabrication: '2026-11-01',
        quantite_initiale: 2,
      }).expect(201);
      await api()
        .post(`/api/v1/lots/${empty.body.lot_id}/pertes`)
        .set(asA())
        .send({ quantite: 2 })
        .expect(201);

      const numeros = async (qs: string) =>
        (
          (await api().get(`/api/v1/lots${qs}`).set(asA()).expect(200)).body.items as {
            numero: string;
          }[]
        ).map((l) => l.numero);
      expect(await numeros('?statut=perime')).toEqual(['OLD-1']);
      expect(await numeros('?statut=epuise')).toEqual(['EMPTY-1']);
      expect(await numeros('?statut=disponible')).not.toContain('OLD-1');

      const page = await api().get('/api/v1/lots?page=1&pageSize=2').set(asA()).expect(200);
      expect(page.body).toMatchObject({ page: 1, pageSize: 2, total: 5 });
      expect(page.body.items).toHaveLength(2);
    });

    it('buckets expiry alerts by 30 / 60 / 90 days and skips empty or far lots', async () => {
      const mk = (numero: string, peremption: string) =>
        createLot({
          produit_id: ids.savon,
          numero,
          date_fabrication: '2026-01-01',
          date_peremption: peremption,
          quantite_initiale: 3,
        }).expect(201);
      await mk('A-J10', '2026-11-21');
      await mk('A-J45', '2026-12-26');
      await mk('A-J80', '2027-01-30');
      await mk('A-J120', '2027-03-11');

      const alertes = async (jours: string) =>
        (
          (
            await api()
              .get(`/api/v1/stock/alertes-peremption?jours=${jours}`)
              .set(asA())
              .expect(200)
          ).body as { numero: string; niveau: string; jours_restants: number }[]
        ).map((a) => `${a.numero}:${a.niveau}:${a.jours_restants}`);
      expect(await alertes('90')).toEqual([
        'OLD-1:perime:0',
        'A-J10:j30:10',
        'A-J45:j60:45',
        'A-J80:j90:80',
      ]);
      expect(await alertes('30')).toEqual(['OLD-1:perime:0', 'A-J10:j30:10']);
      await api().get('/api/v1/stock/alertes-peremption?jours=45').set(asA()).expect(400);
    });
  });

  describe('outbox', () => {
    it('every event is a valid v1 envelope without personal data', async () => {
      const rows = await ownerQuery<{
        event_id: string;
        type: EventType;
        coop_id: string;
        created_at: Date;
        payload: Record<string, unknown>;
      }>(db, 'SELECT event_id, type, coop_id, created_at, payload FROM outbox ORDER BY created_at');
      expect(rows.length).toBeGreaterThan(10);
      for (const row of rows) {
        expect(() =>
          assertValidEvent({
            event_id: row.event_id,
            type: row.type,
            version: 1,
            coop_id: row.coop_id,
            occurred_at: row.created_at.toISOString(),
            is_synthetic: false,
            payload: row.payload,
          }),
        ).not.toThrow();
      }
      // One stock_modifie per movement: the event stream reproduces the operational stock.
      const [counts] = await ownerQuery<{ movements: number; events: number }>(
        db,
        `SELECT (SELECT count(*) FROM mouvement_stock)::int AS movements,
                (SELECT count(*) FROM outbox WHERE type = 'stock_modifie')::int AS events`,
      );
      expect(counts?.events).toBe(counts?.movements);
    });
  });
});
