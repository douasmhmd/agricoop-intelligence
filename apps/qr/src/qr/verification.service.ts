import { Inject, Injectable, Logger } from '@nestjs/common';
import { cooperative, type Database, lot, produit, qr_code, scan_qr, unite } from '@agricoop/db';
import {
  AppProblem,
  appendEvent,
  CLOCK,
  type Clock,
  DB,
  METRICS_REGISTRY,
  Problems,
  TenantDb,
  today,
} from '@agricoop/nest-kit';
import { isExpired, toIsoTimestamp, type Verification } from '@agricoop/shared';
import { and, eq, gt, isNotNull, sql } from 'drizzle-orm';
import { Counter, type Registry } from 'prom-client';
import { evaluateScan } from './anomaly';
import { deviceClass, GEO_LOCATOR, type GeoLocator } from './client-info';
import { QR_CONFIG, type QrConfig } from './qr.config';
import { hashQrToken, isWellFormedQrToken } from './tokens';

const unknownQr = () =>
  new AppProblem(
    404,
    'qr_inconnu',
    'Unknown QR code',
    'This code was not issued by a cooperative on the platform: the product may be counterfeit',
  );

export interface ScanContext {
  headers: Record<string, string | string[] | undefined>;
  /** Used only for an optional geo lookup; never stored or logged. */
  ip: string | undefined;
  userAgent: string | undefined;
}

/**
 * Public QR verification. The token is hashed; the hash is resolved to its cooperative (through
 * qr_lookup() when RLS proposal 001 is applied — auto-detected); everything else runs in that tenant:
 * scan recorded (approximate city + device class, no IP), anomaly rules evaluated, qr_scanne emitted.
 */
@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);
  private hasLookupFn?: Promise<boolean>;
  private readonly verifications: Counter<'resultat'>;

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(TenantDb) private readonly tenantDb: TenantDb,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(QR_CONFIG) private readonly config: QrConfig,
    @Inject(GEO_LOCATOR) private readonly geo: GeoLocator,
    @Inject(METRICS_REGISTRY) registry: Registry,
  ) {
    this.verifications = new Counter({
      name: 'qr_verifications_total',
      help: 'Public QR verifications by result',
      labelNames: ['resultat'] as const,
      registers: [registry],
    });
  }

  async verify(token: string, ctx: ScanContext): Promise<Verification> {
    const found = isWellFormedQrToken(token) ? await this.lookup(hashQrToken(token)) : undefined;
    if (!found) {
      this.verifications.inc({ resultat: 'inconnu' });
      throw unknownQr();
    }
    const ville = this.geo.city(ctx.headers, ctx.ip);
    const appareil = deviceClass(ctx.userAgent);
    const now = this.clock.now();
    const day = today(this.clock);

    const result = await this.tenantDb.runAs(found.coop_id, async (scope) => {
      // Row lock: concurrent scans of the same code are counted one after the other.
      const [q] = await scope.list(qr_code, {
        where: eq(qr_code.qr_id, found.qr_id),
        forUpdate: true,
      });
      if (!q) throw unknownQr();
      const u = q.unite_id ? await scope.findOne(unite, eq(unite.unite_id, q.unite_id)) : undefined;
      const lotId = q.lot_id ?? u?.lot_id;
      const l = lotId ? await scope.findOne(lot, eq(lot.lot_id, lotId)) : undefined;
      const p = l ? await scope.findOne(produit, eq(produit.produit_id, l.produit_id)) : undefined;
      const [coop] = await scope.tx
        .select()
        .from(cooperative)
        .where(eq(cooperative.coop_id, scope.coopId));
      if (!l || !p || !coop) throw Problems.notFound('Lot');

      const scan = await scope.insert(scan_qr, {
        qr_id: q.qr_id,
        date_scan: now.toISOString(),
        ville,
        appareil,
      });
      const since24h = new Date(now.getTime() - 86_400_000).toISOString();
      const [stats] = await scope.tx
        .select({
          nb_scans: sql<number>`count(*)::int`,
          villes_24h: sql<number>`(count(distinct ${scan_qr.ville}) filter (where ${gt(scan_qr.date_scan, since24h)} and ${isNotNull(scan_qr.ville)}))::int`,
        })
        .from(scan_qr)
        .where(and(scope.owns(scan_qr), eq(scan_qr.qr_id, q.qr_id)));

      const niveau = q.niveau as Verification['niveau'];
      const statut = q.statut as Verification['statut_qr'];
      const alertes = evaluateScan(
        {
          niveau,
          statut,
          expired: isExpired(l.date_peremption, day),
          nbScans: stats?.nb_scans ?? 1,
          villes24h: stats?.villes_24h ?? 0,
          quantiteInitiale: l.quantite_initiale,
        },
        this.config.anomaly,
      );
      const resultat = alertes.length === 0 ? 'authentique' : 'alerte';

      await appendEvent(scope, 'qr_scanne', {
        scan_id: scan.scan_id,
        qr_id: q.qr_id,
        niveau,
        lot_id: l.lot_id,
        unite_id: q.unite_id,
        produit_id: p.produit_id,
        date_scan: toIsoTimestamp(scan.date_scan),
        ville,
        appareil,
        statut_qr: statut,
        resultat,
        alertes,
      });

      return {
        resultat,
        alertes,
        statut_qr: statut,
        niveau,
        produit: {
          nom: p.nom,
          famille: p.famille as Verification['produit']['famille'],
          categorie: p.categorie,
        },
        cooperative: { code: coop.code, nom: coop.nom, province: coop.province },
        lot: {
          numero: l.numero,
          date_fabrication: l.date_fabrication,
          date_peremption: l.date_peremption,
        },
        numero_serie: u?.numero_serie ?? null,
        nb_scans: stats?.nb_scans ?? 1,
      } satisfies Verification;
    });

    this.verifications.inc({ resultat: result.resultat });
    if (result.resultat === 'alerte') {
      this.logger.warn({ qr_id: found.qr_id, alertes: result.alertes }, 'QR verification alert');
    }
    return result;
  }

  /** token_hash → (qr_id, coop_id) across tenants. */
  private async lookup(tokenHash: string): Promise<{ qr_id: string; coop_id: string } | undefined> {
    this.hasLookupFn ??= this.db
      .execute<{ present: boolean }>(
        sql`select to_regprocedure('public.qr_lookup(text)') is not null as present`,
      )
      .then((r) => r.rows[0]?.present === true);
    const res = (await this.hasLookupFn)
      ? await this.db.execute<{ qr_id: string; coop_id: string }>(
          sql`select qr_id, coop_id from qr_lookup(${tokenHash})`,
        )
      : await this.db.execute<{ qr_id: string; coop_id: string }>(
          sql`select qr_id, coop_id from qr_code where token_hash = ${tokenHash}`,
        );
    return res.rows[0];
  }
}
