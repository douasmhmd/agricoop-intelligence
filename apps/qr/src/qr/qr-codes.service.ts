import { Inject, Injectable } from '@nestjs/common';
import { cooperative, lot, produit, qr_code, scan_qr, type TenantScope, unite } from '@agricoop/db';
import { AppProblem, CLOCK, type Clock, Problems, TenantDb, today } from '@agricoop/nest-kit';
import {
  isExpired,
  type QrCode,
  type QrCodePage,
  type QrListQuery,
  type QrStatutChange,
  type Scan,
  type ScansParVille,
  type ScansParVilleQuery,
  toIsoTimestamp,
} from '@agricoop/shared';
import { and, asc, count, desc, eq, gte, inArray, max, type SQL, sql } from 'drizzle-orm';
import { evaluateScan } from './anomaly';
import type { LabelSheet } from './labels-pdf';
import { QR_CONFIG, type QrConfig } from './qr.config';
import { generateQrToken, hashQrToken } from './tokens';

/** Back-office side of QR codes: generation (labels), listing with scan stats, status changes. */
@Injectable()
export class QrCodesService {
  constructor(
    @Inject(TenantDb) private readonly tenantDb: TenantDb,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(QR_CONFIG) private readonly config: QrConfig,
  ) {}

  /**
   * Issues the QR codes of a lot — one for the lot, or one per unit, following produit.niveau_qr —
   * and returns the label data with the clear tokens (rendered into the PDF, never stored).
   * 409 `qr_deja_generes` if active codes exist, unless `regenerer` (they are deactivated first).
   */
  async generate(lotId: string, regenerer: boolean): Promise<LabelSheet> {
    return this.tenantDb.run(async (scope) => {
      // Lock the lot: concurrent generations for the same lot are serialized.
      const [l] = await scope.list(lot, { where: eq(lot.lot_id, lotId), forUpdate: true });
      if (!l) throw Problems.notFound('Lot');
      const p = await scope.findOne(produit, eq(produit.produit_id, l.produit_id));
      if (!p) throw Problems.notFound('Produit');
      const [coop] = await scope.tx
        .select({ nom: cooperative.nom })
        .from(cooperative)
        .where(eq(cooperative.coop_id, scope.coopId));

      const parUnite = p.niveau_qr === 'unite';
      const unites = parUnite
        ? await scope.list(unite, {
            where: eq(unite.lot_id, lotId),
            orderBy: [asc(unite.numero_serie)],
          })
        : [];
      const targets = parUnite
        ? unites.map((u) => ({ uniteId: u.unite_id, numeroSerie: u.numero_serie }))
        : [{ uniteId: null, numeroSerie: null }];
      if (targets.length === 0) throw Problems.notFound('Unités du lot');
      if (targets.length > this.config.maxLabels) {
        throw new AppProblem(
          422,
          'trop_d_etiquettes',
          'Too many labels',
          `A lot can print at most ${this.config.maxLabels} labels at once`,
        );
      }

      const actifs = await this.activeCodesOfLot(
        scope,
        lotId,
        unites.map((u) => u.unite_id),
      );
      if (actifs.length > 0) {
        if (!regenerer) {
          throw new AppProblem(
            409,
            'qr_deja_generes',
            'QR codes already issued',
            'Tokens cannot be printed twice: regenerate to deactivate the current codes and issue new ones',
            { nb_actifs: actifs.length },
          );
        }
        await scope.update(qr_code, { statut: 'desactive' }, inArray(qr_code.qr_id, actifs));
      }

      const labels = targets.map((t) => ({ ...t, token: generateQrToken() }));
      await scope.insert(
        qr_code,
        labels.map((lab) =>
          lab.uniteId
            ? { niveau: 'unite', unite_id: lab.uniteId, token_hash: hashQrToken(lab.token) }
            : { niveau: 'lot', lot_id: lotId, token_hash: hashQrToken(lab.token) },
        ),
      );

      return {
        coopNom: coop?.nom ?? '',
        produitNom: p.nom,
        lotNumero: l.numero,
        datePeremption: l.date_peremption,
        verifyBaseUrl: this.config.webPublicUrl,
        labels: labels.map((lab) => ({ token: lab.token, numeroSerie: lab.numeroSerie })),
      };
    });
  }

  async list(query: QrListQuery): Promise<QrCodePage> {
    return this.tenantDb.run(async (scope) => {
      const rows = await this.statsQuery(scope, {
        where: and(
          query.lot_id ? eq(lot.lot_id, query.lot_id) : undefined,
          query.statut ? eq(qr_code.statut, query.statut) : undefined,
        ),
        limit: query.pageSize,
        offset: (query.page - 1) * query.pageSize,
      });
      return {
        items: rows.map((r) => this.toQrCode(r)),
        total: rows[0]?.total ?? 0,
        page: query.page,
        pageSize: query.pageSize,
      };
    });
  }

  async get(qrId: string): Promise<QrCode> {
    return this.tenantDb.run(async (scope) => this.getIn(scope, qrId));
  }

  /** Deactivate (desactive), flag (signale) or reactivate (actif) a code. */
  async changeStatut(qrId: string, change: QrStatutChange): Promise<QrCode> {
    return this.tenantDb.run(async (scope) => {
      const updated = await scope.update(
        qr_code,
        { statut: change.statut },
        eq(qr_code.qr_id, qrId),
      );
      if (updated.length === 0) throw Problems.notFound('QR code');
      return this.getIn(scope, qrId);
    });
  }

  async scans(qrId: string): Promise<Scan[]> {
    return this.tenantDb.run(async (scope) => {
      await this.getIn(scope, qrId);
      const rows = await scope.list(scan_qr, {
        where: eq(scan_qr.qr_id, qrId),
        orderBy: [desc(scan_qr.date_scan)],
        limit: 500,
      });
      return rows.map((s) => ({
        scan_id: s.scan_id,
        date_scan: toIsoTimestamp(s.date_scan),
        ville: s.ville,
        appareil: s.appareil,
        is_synthetic: s.is_synthetic,
      }));
    });
  }

  /** Scans per city over the last `jours` days (for the back-office map / list). */
  async scansParVille(query: ScansParVilleQuery): Promise<ScansParVille[]> {
    const since = new Date(this.clock.now().getTime() - query.jours * 86_400_000).toISOString();
    return this.tenantDb.run(async (scope) => {
      const ville = sql<string>`coalesce(${scan_qr.ville}, 'Inconnue')`;
      const rows = await scope.tx
        .select({
          ville,
          nb_scans: sql<number>`count(*)::int`,
          nb_qr: sql<number>`count(distinct ${scan_qr.qr_id})::int`,
        })
        .from(scan_qr)
        .where(and(scope.owns(scan_qr), gte(scan_qr.date_scan, since)))
        .groupBy(ville)
        .orderBy(desc(count()), asc(ville));
      return rows;
    });
  }

  /* -------------------------------------------------------------------------------------------- */

  private async activeCodesOfLot(
    scope: TenantScope,
    lotId: string,
    uniteIds: string[],
  ): Promise<string[]> {
    const rows = await scope.tx
      .select({ qr_id: qr_code.qr_id })
      .from(qr_code)
      .where(
        and(
          scope.owns(qr_code),
          eq(qr_code.statut, 'actif'),
          uniteIds.length > 0 ? inArray(qr_code.unite_id, uniteIds) : eq(qr_code.lot_id, lotId),
        ),
      );
    return rows.map((r) => r.qr_id);
  }

  private async getIn(scope: TenantScope, qrId: string): Promise<QrCode> {
    const [row] = await this.statsQuery(scope, { where: eq(qr_code.qr_id, qrId), limit: 1 });
    if (!row) throw Problems.notFound('QR code');
    return this.toQrCode(row);
  }

  private statsQuery(
    scope: TenantScope,
    options: { where?: SQL; limit?: number; offset?: number },
  ) {
    const since24h = new Date(this.clock.now().getTime() - 86_400_000).toISOString();
    let query = scope.tx
      .select({
        qr_id: qr_code.qr_id,
        niveau: qr_code.niveau,
        statut: qr_code.statut,
        created_at: qr_code.created_at,
        is_synthetic: qr_code.is_synthetic,
        unite_id: qr_code.unite_id,
        numero_serie: unite.numero_serie,
        lot_id: lot.lot_id,
        lot_numero: lot.numero,
        date_peremption: lot.date_peremption,
        quantite_initiale: lot.quantite_initiale,
        produit_code: produit.code,
        nb_scans: sql<number>`count(${scan_qr.scan_id})::int`,
        nb_villes: sql<number>`count(distinct ${scan_qr.ville})::int`,
        villes_24h: sql<number>`(count(distinct ${scan_qr.ville}) filter (where ${scan_qr.date_scan} > ${since24h}))::int`,
        dernier_scan: max(scan_qr.date_scan),
        total: sql<number>`(count(*) over ())::int`,
      })
      .from(qr_code)
      .leftJoin(unite, and(eq(unite.unite_id, qr_code.unite_id), scope.owns(unite)))
      .innerJoin(
        lot,
        and(eq(lot.lot_id, sql`coalesce(${qr_code.lot_id}, ${unite.lot_id})`), scope.owns(lot)),
      )
      .innerJoin(produit, and(eq(produit.produit_id, lot.produit_id), scope.owns(produit)))
      .leftJoin(scan_qr, and(eq(scan_qr.qr_id, qr_code.qr_id), scope.owns(scan_qr)))
      .where(options.where ? and(scope.owns(qr_code), options.where) : scope.owns(qr_code))
      .groupBy(qr_code.qr_id, unite.unite_id, lot.lot_id, produit.produit_id)
      .orderBy(asc(lot.numero), asc(unite.numero_serie), asc(qr_code.created_at))
      .$dynamic();
    if (options.limit !== undefined) query = query.limit(options.limit);
    if (options.offset !== undefined) query = query.offset(options.offset);
    return query;
  }

  private toQrCode(r: Awaited<ReturnType<QrCodesService['statsQuery']>>[number]): QrCode {
    const niveau = r.niveau as QrCode['niveau'];
    const statut = r.statut as QrCode['statut'];
    return {
      qr_id: r.qr_id,
      niveau,
      statut,
      lot_id: r.lot_id,
      lot_numero: r.lot_numero,
      unite_id: r.unite_id,
      numero_serie: r.numero_serie,
      produit_code: r.produit_code,
      created_at: toIsoTimestamp(r.created_at),
      nb_scans: r.nb_scans,
      nb_villes: r.nb_villes,
      dernier_scan: r.dernier_scan ? toIsoTimestamp(r.dernier_scan) : null,
      alertes: evaluateScan(
        {
          niveau,
          statut,
          expired: isExpired(r.date_peremption, today(this.clock)),
          nbScans: r.nb_scans,
          villes24h: r.villes_24h,
          quantiteInitiale: r.quantite_initiale,
        },
        this.config.anomaly,
      ),
      is_synthetic: r.is_synthetic,
    };
  }
}
