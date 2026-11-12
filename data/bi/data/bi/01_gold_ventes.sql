-- =============================================================================
-- AgriCoop Intelligence — couche Gold (BI), partie 1 : ventes et KPI mensuels
-- Fichier : data/bi/01_gold_ventes.sql
-- Ces vues lisent les tables de l'application sans jamais les modifier.(important)
-- Chaque vue porte coop_id : c'est la clé de la sécurité par coopérative (RLS).
-- Aucune donnée personnelle : la table client_pii n'est jamais lue.
-- =============================================================================
create schema if not exists gold;

-- Date de référence de l'analyse : le lendemain de la dernière commande
create or replace view gold.v_date_reference as
select coop_id, max(date_commande)::date + 1 as date_reference
from commande
group by coop_id;

-- Ventes par jour, produit et canal : quantités, chiffre d'affaires, coûts, marge
create or replace view gold.v_ventes_jour as
select c.coop_id,
       c.date_commande::date                               as jour,
       p.code                                              as produit,
       p.famille,
       p.categorie,
       c.canal,
       sum(lc.quantite)                                    as quantite,
       sum(lc.quantite * lc.prix_unitaire_mad)             as ca_mad,
       sum(lc.quantite * p.cout_mad)                       as cout_mad,
       sum(lc.quantite * (lc.prix_unitaire_mad - p.cout_mad)) as marge_mad
from ligne_commande lc
join commande c using (commande_id)
join produit p on p.produit_id = lc.produit_id
group by 1, 2, 3, 4, 5, 6;

-- KPI mensuels : commandes, CA, marge, panier moyen, clients actifs et nouveaux
create or replace view gold.v_kpi_mensuel as
with commandes as (
    select c.coop_id, date_trunc('month', c.date_commande)::date as mois,
           c.commande_id, c.client_id,
           sum(lc.quantite * lc.prix_unitaire_mad)                as ca,
           sum(lc.quantite * (lc.prix_unitaire_mad - p.cout_mad)) as marge
    from commande c
    join ligne_commande lc using (commande_id)
    join produit p on p.produit_id = lc.produit_id
    group by 1, 2, 3, 4
),
premiere as (
    select client_id, date_trunc('month', min(date_commande))::date as mois_premiere
    from commande
    group by client_id
)
select cm.coop_id,
       cm.mois,
       count(*)                                         as commandes,
       sum(cm.ca)                                       as ca_mad,
       sum(cm.marge)                                    as marge_mad,
       round(sum(cm.marge) / sum(cm.ca), 4)             as taux_marge,
       round(avg(cm.ca), 2)                             as panier_moyen_mad,
       count(distinct cm.client_id)                     as clients_actifs,
       count(distinct cm.client_id) filter (where pr.mois_premiere = cm.mois) as nouveaux_clients
from commandes cm
join premiere pr using (client_id)
group by cm.coop_id, cm.mois;
