import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import type { Pool } from '@agricoop/db';
import { AppProblem, RequestContext } from '@agricoop/nest-kit';
import {
  type AlerteQr,
  type AnomalieStock,
  campagneBounds,
  type ClientSegment,
  type KpiMensuel,
  type LotSurveille,
  niveauAlerteStock,
  type PrevisionAnalytics,
  type RisqueInvendu,
  type Segment,
  type StockProduit,
} from '@agricoop/shared';

/** pg pool connected as `analytics_reader` (SELECT on schema `gold` only), or null if unset. */
export const ANALYTICS_POOL = Symbol('ANALYTICS_POOL');

/*
 * Read-only analytics over the data plane's `gold` views (data/bi/*.sql), as specified by
 * contracts/api/analytics.yaml:
 * - every query filters on the request's cooperative (token, or the audited saas_admin choice),
 *   never on a query parameter;
 * - the connection role can read `gold` only — not the application tables, not client_pii;
 * - numbers come back from PostgreSQL as strings (numeric / bigint) and are converted to JSON
 *   numbers here, as the contract specifies.
 */
@Injectable()
export class AnalyticsService implements OnModuleDestroy {
  constructor(@Inject(ANALYTICS_POOL) private readonly pool: Pool | null) {}

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
  }

  private async query<R>(sql: string, params: unknown[] = []): Promise<R[]> {
    if (!this.pool) {
      throw new AppProblem(
        503,
        'analytics_indisponible',
        'Analytics unavailable',
        'The analytics database is not configured',
      );
    }
    const coopId = RequestContext.requireTenant();
    const res = await this.pool.query(sql, [coopId, ...params]);
    return res.rows as R[];
  }

  /** Reference date of the cooperative's analysis (X-Date-Reference), or null without orders. */
  async dateReference(): Promise<string | null> {
    const [row] = await this.query<{ d: string }>(
      `SELECT to_char(date_reference, 'YYYY-MM-DD') AS d
         FROM gold.v_date_reference WHERE coop_id = $1`,
    );
    return row?.d ?? null;
  }

  async kpiMensuels(campagne?: string): Promise<KpiMensuel[]> {
    const bounds = campagne ? campagneBounds(campagne) : null;
    const rows = await this.query<Record<string, string>>(
      `SELECT to_char(mois, 'YYYY-MM-DD') AS mois, commandes, ca_mad, marge_mad, taux_marge,
              panier_moyen_mad, clients_actifs, nouveaux_clients
         FROM gold.v_kpi_mensuel
        WHERE coop_id = $1
          AND ($2::date IS NULL OR mois >= $2::date)
          AND ($3::date IS NULL OR mois <= $3::date)
        ORDER BY mois`,
      [bounds?.debut ?? null, bounds?.fin ?? null],
    );
    return rows.map((r) => ({
      mois: r.mois!,
      commandes: int(r.commandes),
      ca_mad: num(r.ca_mad),
      marge_mad: num(r.marge_mad),
      taux_marge: num(r.taux_marge),
      panier_moyen_mad: num(r.panier_moyen_mad),
      clients_actifs: int(r.clients_actifs),
      nouveaux_clients: int(r.nouveaux_clients),
    }));
  }

  async stocks(): Promise<StockProduit[]> {
    const rows = await this.query<Record<string, string | null>>(
      `SELECT produit, famille, stock_disponible, vente_moy_jour, couverture_jours
         FROM gold.v_stock_produit WHERE coop_id = $1 ORDER BY produit`,
    );
    return rows.map((r) => {
      const stock = int(r.stock_disponible);
      const couverture = r.couverture_jours === null ? null : int(r.couverture_jours);
      return {
        produit: r.produit!,
        famille: r.famille as StockProduit['famille'],
        stock_disponible: stock,
        vente_moy_jour: num(r.vente_moy_jour),
        couverture_jours: couverture,
        niveau_alerte: niveauAlerteStock(stock, couverture),
      };
    });
  }

  async lotsASurveiller(): Promise<LotSurveille[]> {
    const rows = await this.query<Record<string, string>>(
      `SELECT produit, lot, to_char(date_peremption, 'YYYY-MM-DD') AS date_peremption,
              stock_actuel, jours_avant_peremption
         FROM gold.v_stock_lot
        WHERE coop_id = $1 AND statut = 'à surveiller' AND stock_actuel > 0
        ORDER BY date_peremption, lot`,
    );
    return rows.map((r) => ({
      produit: r.produit!,
      lot: r.lot!,
      date_peremption: r.date_peremption!,
      stock_actuel: int(r.stock_actuel),
      jours_avant_peremption: int(r.jours_avant_peremption),
    }));
  }

  async risqueInvendus(): Promise<RisqueInvendu[]> {
    const rows = await this.query<Record<string, string>>(
      `SELECT produit, lot, to_char(date_peremption, 'YYYY-MM-DD') AS date_peremption,
              stock_actuel, vente_moy_jour, unites_a_risque, valeur_a_risque_mad
         FROM gold.v_risque_invendus
        WHERE coop_id = $1 AND unites_a_risque > 0
        ORDER BY valeur_a_risque_mad DESC, lot`,
    );
    return rows.map((r) => ({
      produit: r.produit!,
      lot: r.lot!,
      date_peremption: r.date_peremption!,
      stock_actuel: int(r.stock_actuel),
      vente_moy_jour: num(r.vente_moy_jour),
      unites_a_risque: int(r.unites_a_risque),
      valeur_a_risque_mad: num(r.valeur_a_risque_mad),
    }));
  }

  async previsions(famille?: string): Promise<PrevisionAnalytics[]> {
    const rows = await this.query<Record<string, string | boolean | null>>(
      `SELECT famille, to_char(semaine, 'YYYY-MM-DD') AS semaine, quantite_prevue, ventes, ecart,
              semaine_a_venir, version_modele
         FROM gold.v_prevision_vs_ventes
        WHERE coop_id = $1 AND ($2::text IS NULL OR famille = $2::text)
        ORDER BY famille, semaine, version_modele`,
      [famille ?? null],
    );
    return rows.map((r) => ({
      famille: r.famille as PrevisionAnalytics['famille'],
      semaine: r.semaine as string,
      quantite_prevue: num(r.quantite_prevue as string),
      ventes: r.ventes === null ? null : int(r.ventes as string),
      ecart: r.ecart === null ? null : num(r.ecart as string),
      semaine_a_venir: r.semaine_a_venir === true,
      version_modele: r.version_modele as string,
    }));
  }

  async alertesQr(niveau?: string): Promise<AlerteQr[]> {
    const rows = await this.query<Record<string, string>>(
      `SELECT qr_id, niveau, nb_scans, nb_villes, distance_max_km, duree_jours,
              to_char(date_analyse, 'YYYY-MM-DD') AS date_analyse
         FROM gold.v_alertes_qr_actuelles
        WHERE coop_id = $1 AND ($2::text IS NULL OR niveau = $2::text)
        ORDER BY nb_villes DESC, nb_scans DESC, qr_id`,
      [niveau ?? null],
    );
    return rows.map((r) => ({
      qr_id: r.qr_id!,
      niveau: r.niveau as AlerteQr['niveau'],
      nb_scans: int(r.nb_scans),
      nb_villes: int(r.nb_villes),
      distance_max_km: num(r.distance_max_km),
      duree_jours: num(r.duree_jours),
      date_analyse: r.date_analyse!,
    }));
  }

  async segments(): Promise<Segment[]> {
    const rows = await this.query<Record<string, string>>(
      `SELECT segment,
              count(*) AS clients,
              round(count(*)::numeric / sum(count(*)) OVER (), 4) AS part_clients,
              round(coalesce(sum(montant_mad) / nullif(sum(sum(montant_mad)) OVER (), 0), 0), 4)
                AS part_ca
         FROM gold.v_segments_actuels
        WHERE coop_id = $1
        GROUP BY segment
        ORDER BY sum(montant_mad) DESC, segment`,
    );
    return rows.map((r) => ({
      segment: r.segment!,
      clients: int(r.clients),
      part_clients: num(r.part_clients),
      part_ca: num(r.part_ca),
    }));
  }

  async clientsDuSegment(segment: string): Promise<ClientSegment[]> {
    const rows = await this.query<Record<string, string>>(
      `SELECT client_id, recence_j, frequence, montant_mad
         FROM gold.v_segments_actuels
        WHERE coop_id = $1 AND segment = $2
        ORDER BY montant_mad DESC, client_id`,
      [segment],
    );
    return rows.map((r) => ({
      client_id: r.client_id!,
      recence_j: int(r.recence_j),
      frequence: int(r.frequence),
      montant_mad: num(r.montant_mad),
    }));
  }

  async anomaliesStock(): Promise<AnomalieStock[]> {
    const rows = await this.query<Record<string, string>>(
      `SELECT produit, lot, stock_actuel, anomalie
         FROM gold.v_anomalies_stock WHERE coop_id = $1 ORDER BY produit, lot`,
    );
    return rows.map((r) => ({
      produit: r.produit!,
      lot: r.lot!,
      stock_actuel: int(r.stock_actuel),
      anomalie: r.anomalie!,
    }));
  }
}

const num = (v: string | null | undefined): number =>
  v === null || v === undefined ? 0 : Number(v);
const int = (v: string | null | undefined): number => Math.trunc(num(v));
