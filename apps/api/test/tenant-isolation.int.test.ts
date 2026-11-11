/*
 * Tenant isolation — mandatory test. Runs the same suite twice:
 *   1. schema.sql as is, app connected as the table owner (no RLS): isolation comes from withTenant;
 *   2. with contracts/db/proposals/001_rls.sql applied, app connected as an `agricoop_app` member:
 *      isolation is enforced twice, and RLS alone catches a query that forgot the tenant predicate.
 */
import { produit } from '@agricoop/db';
import { TenantDb } from '@agricoop/nest-kit';
import {
  createTestIssuer,
  ownerQuery,
  startTestDatabase,
  type TestDatabase,
  type TestIssuer,
} from '@agricoop/testing';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './support/test-app';

const COOP_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const COOP_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const UNKNOWN_COOP = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const codes = (body: unknown): string[] => (body as { code: string }[]).map((p) => p.code);

async function seed(db: TestDatabase): Promise<{ a: string[]; b: string[] }> {
  await ownerQuery(
    db,
    `INSERT INTO cooperative (coop_id, code, nom, province) VALUES
       ($1, 'COOPA', 'Coopérative A', 'Ouezzane'), ($2, 'COOPB', 'Coopérative B', 'Taounate')`,
    [COOP_A, COOP_B],
  );
  const insert = (coop: string, code: string) =>
    ownerQuery<{ produit_id: string }>(
      db,
      `INSERT INTO produit (coop_id, code, nom, famille, categorie, prix_mad, cout_mad,
                            conservation_j, niveau_qr)
       VALUES ($1, $2, $2, 'alimentaire', 'huile', 75.00, 41.25, 540, 'lot') RETURNING produit_id`,
      [coop, code],
    ).then((rows) => rows[0]!.produit_id);
  return {
    a: [await insert(COOP_A, 'A-HVE-1L'), await insert(COOP_A, 'A-SAV-100')],
    b: [await insert(COOP_B, 'B-HVE-1L'), await insert(COOP_B, 'B-OVC-1KG')],
  };
}

describe.each([{ rls: false }, { rls: true }])('tenant isolation (rls: $rls)', ({ rls }) => {
  let db: TestDatabase;
  let issuer: TestIssuer;
  let app: NestFastifyApplication;
  let ids: { a: string[]; b: string[] };
  const tokens: Record<string, string> = {};

  const api = () => request(app.getHttpServer());
  const as = (who: string) => ({ authorization: `Bearer ${tokens[who]}` });

  beforeAll(async () => {
    [db, issuer] = await Promise.all([startTestDatabase({ rls }), createTestIssuer()]);
    ids = await seed(db);
    app = await createTestApp(db, issuer);
    tokens.managerA = await issuer.sign({ roles: ['coop_manager'], tenantId: COOP_A });
    tokens.managerB = await issuer.sign({ roles: ['coop_manager'], tenantId: COOP_B });
    tokens.customer = await issuer.sign({ roles: ['customer'] });
    tokens.admin = await issuer.sign({ roles: ['saas_admin'] });
  });

  afterAll(async () => {
    await app?.close();
    await db?.stop();
  });

  describe('HTTP', () => {
    it("lists only the caller's products", async () => {
      const res = await api().get('/api/v1/produits').set(as('managerA')).expect(200);
      expect(codes(res.body)).toEqual(['A-HVE-1L', 'A-SAV-100']);
    });

    it("returns 404 (not 403) for another cooperative's product", async () => {
      const res = await api().get(`/api/v1/produits/${ids.b[0]}`).set(as('managerA')).expect(404);
      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.body).toMatchObject({ status: 404, code: 'not_found' });
    });

    it('returns its own product without exposing coop_id', async () => {
      const res = await api().get(`/api/v1/produits/${ids.a[0]}`).set(as('managerA')).expect(200);
      expect(res.body).toMatchObject({ code: 'A-HVE-1L', prix_mad: '75.00', cout_mad: '41.25' });
      expect(res.body).not.toHaveProperty('coop_id');
    });

    it('rejects a manager trying to switch tenant with X-Coop-Id', async () => {
      const res = await api()
        .get('/api/v1/produits')
        .set(as('managerA'))
        .set('x-coop-id', COOP_B)
        .expect(403);
      expect(res.body.code).toBe('tenant_mismatch');
    });

    it('lets saas_admin act on a tenant chosen with X-Coop-Id', async () => {
      const res = await api()
        .get('/api/v1/produits')
        .set(as('admin'))
        .set('x-coop-id', COOP_B)
        .expect(200);
      expect(codes(res.body)).toEqual(['B-HVE-1L', 'B-OVC-1KG']);
    });

    it('requires saas_admin to choose an existing tenant', async () => {
      expect((await api().get('/api/v1/produits').set(as('admin')).expect(400)).body.code).toBe(
        'coop_header_required',
      );
      expect(
        (await api().get('/api/v1/produits').set(as('admin')).set('x-coop-id', 'nope').expect(400))
          .body.code,
      ).toBe('invalid_coop_header');
      expect(
        (
          await api()
            .get('/api/v1/produits')
            .set(as('admin'))
            .set('x-coop-id', UNKNOWN_COOP)
            .expect(404)
        ).body.code,
      ).toBe('unknown_cooperative');
    });

    it('forbids customers on back-office routes', async () => {
      await api().get('/api/v1/produits').set(as('customer')).expect(403);
    });

    it('rejects missing, foreign-signed, expired and wrong-audience tokens with 401', async () => {
      const missing = await api().get('/api/v1/produits').expect(401);
      expect(missing.headers['www-authenticate']).toBe('Bearer');
      const bad = [
        await issuer.signWithForeignKey({ roles: ['coop_manager'], tenantId: COOP_A }),
        await issuer.sign({ roles: ['coop_manager'], tenantId: COOP_A, expiresIn: -120 }),
        await issuer.sign({ roles: ['coop_manager'], tenantId: COOP_A, audience: 'account' }),
        await issuer.sign({ roles: ['coop_manager'], tenantId: COOP_A, issuer: 'http://evil' }),
      ];
      for (const token of bad) {
        await api().get('/api/v1/produits').set('authorization', `Bearer ${token}`).expect(401);
      }
    });

    it('validates path parameters with a problem+json 400', async () => {
      const res = await api().get('/api/v1/produits/not-a-uuid').set(as('managerA')).expect(400);
      expect(res.headers['content-type']).toContain('application/problem+json');
    });

    it('serves /me without a tenant', async () => {
      expect((await api().get('/api/v1/me').set(as('customer')).expect(200)).body).toEqual({
        roles: ['customer'],
        coop_id: null,
      });
      expect((await api().get('/api/v1/me').set(as('managerB')).expect(200)).body).toEqual({
        roles: ['coop_manager'],
        coop_id: COOP_B,
      });
    });
  });

  describe('TenantScope', () => {
    const tenantDb = () => app.get(TenantDb);

    it('forces coop_id on insert, even if a caller sneaks one in', async () => {
      const row = await tenantDb().runAs(COOP_A, (s) =>
        s.insert(produit, {
          code: 'A-INJECT',
          nom: 'x',
          famille: 'alimentaire',
          categorie: 'huile',
          prix_mad: '1.00',
          cout_mad: '0.50',
          conservation_j: 10,
          niveau_qr: 'lot',
          ...({ coop_id: COOP_B } as object),
        }),
      );
      expect(row.coop_id).toBe(COOP_A);
      await tenantDb().runAs(COOP_A, (s) =>
        s.delete(produit, eq(produit.produit_id, row.produit_id)),
      );
    });

    it('cannot update or delete another tenant’s rows, nor move a row to another tenant', async () => {
      const updated = await tenantDb().runAs(COOP_A, (s) =>
        s.update(produit, { nom: 'hijack' }, eq(produit.produit_id, ids.b[0]!)),
      );
      expect(updated).toHaveLength(0);
      const deleted = await tenantDb().runAs(COOP_A, (s) =>
        s.delete(produit, eq(produit.produit_id, ids.b[1]!)),
      );
      expect(deleted).toHaveLength(0);
      const moved = await tenantDb().runAs(COOP_A, (s) =>
        s.update(
          produit,
          { ...({ coop_id: COOP_B } as object) },
          eq(produit.produit_id, ids.a[1]!),
        ),
      );
      expect(moved[0]?.coop_id).toBe(COOP_A);
    });

    it(
      rls
        ? 'RLS hides other tenants even from a raw query that forgot the predicate'
        : 'without RLS, a raw query that forgets the predicate is NOT isolated (why proposal 001 exists)',
      async () => {
        const rows = await tenantDb().runAs(COOP_A, (s) => s.tx.select().from(produit));
        const coops = new Set(rows.map((r) => r.coop_id));
        if (rls) expect([...coops]).toEqual([COOP_A]);
        else expect(coops).toEqual(new Set([COOP_A, COOP_B]));
      },
    );

    it('rejects a malformed tenant id before touching the database', async () => {
      await expect(tenantDb().runAs("x' OR 1=1 --", (s) => s.select(produit))).rejects.toThrow(
        'Invalid tenant id',
      );
    });
  });
});
