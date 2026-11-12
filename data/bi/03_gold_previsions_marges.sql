-- =============================================================================
-- AgriCoop Intelligence — couche Gold (BI), partie 3 : prévisions face aux ventes,
-- marge par litre d'huile, dernières analyses ML (segments, alertes QR)
-- Fichier : data/bi/03_gold_previsions_marges.sql   (nécessite 01 et 02)
-- =============================================================================

-- Prévisions du modèle face aux ventes réelles, par famille et par semaine
drop view if exists gold.v_prevision_vs_ventes;
create view gold.v_prevision_vs_ventes as
with ventes as (
    select coop_id, famille, date_trunc('week', jour)::date as semaine, sum(quantite) as ventes
    from gold.v_ventes_jour
    group by 1, 2, 3
)
select p.coop_id,
       p.famille,
       p.semaine,
       p.version_modele,
       (p.semaine + 7 > r.date_reference)               as semaine_a_venir,
       round(p.quantite_prevue)                         as quantite_prevue,
       -- semaine terminée : ventes réelles (0 s'il n'y en a eu aucune) ; semaine à venir : vide
       case when p.semaine + 7 <= r.date_reference then coalesce(v.ventes, 0) end as ventes,
       case when p.semaine + 7 <= r.date_reference
            then coalesce(v.ventes, 0) - round(p.quantite_prevue) end           as ecart
from prevision p
join gold.v_date_reference r on r.coop_id = p.coop_id
left join ventes v on v.coop_id = p.coop_id and v.famille = p.famille and v.semaine = p.semaine;

-- Marge par litre d'huile selon la destination du produit (bouteille ou transformation).
-- Indicatif : les coûts de revient sont encore des hypothèses (pas de nomenclature).
drop view if exists gold.v_marge_par_litre_huile;
create view gold.v_marge_par_litre_huile as
with volumes as (
    select coop_id, produit, sum(quantite) as unites_vendues, sum(marge_mad) as marge_totale_mad
    from gold.v_ventes_jour
    group by 1, 2
)
select p.coop_id,
       p.code                                              as produit,
       p.famille,
       p.categorie,
       p.prix_mad,
       p.cout_mad,
       p.prix_mad - p.cout_mad                             as marge_unitaire_mad,
       round(p.huile_ml_par_unite / 1000.0, 3)             as huile_litres_par_unite,
       round((p.prix_mad - p.cout_mad) / (p.huile_ml_par_unite / 1000.0), 2) as marge_par_litre_huile_mad,
       coalesce(v.unites_vendues, 0)                       as unites_vendues,
       round(coalesce(v.unites_vendues, 0) * p.huile_ml_par_unite / 1000.0, 1) as huile_consommee_litres,
       coalesce(v.marge_totale_mad, 0)                     as marge_totale_mad
from produit p
left join volumes v on v.coop_id = p.coop_id and v.produit = p.code
where p.huile_ml_par_unite > 0;

-- Dernière segmentation des clients (la plus récente pour chaque coopérative)
create or replace view gold.v_segments_actuels as
select s.*
from gold.segment_client s
where s.date_analyse = (select max(date_analyse) from gold.segment_client x where x.coop_id = s.coop_id);

-- Dernières alertes de copies de QR code
create or replace view gold.v_alertes_qr_actuelles as
select a.*
from gold.alerte_qr a
where a.date_analyse = (select max(date_analyse) from gold.alerte_qr x where x.coop_id = a.coop_id);
