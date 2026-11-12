-- =============================================================================
-- AgriCoop Intelligence — couche Gold (BI), partie 2 : stocks, péremptions,
-- risque d'invendus et pertes
-- Fichier : data/bi/02_gold_stocks.sql   (nécessite 01_gold_ventes.sql)
-- Le fichier peut être rejoué : chaque objet est recréé.
-- =============================================================================
drop view if exists gold.v_risque_invendus, gold.v_stock_produit, gold.v_stock_lot;

-- Stock de chaque lot à la date de référence, et délai avant péremption
create view gold.v_stock_lot as
select l.coop_id,
       p.code                         as produit,
       p.famille,
       l.lot_id,
       l.numero                       as lot,
       l.date_fabrication,
       l.date_peremption,
       l.quantite_initiale,
       coalesce(sum(case when m.type_mouvement = 'entree' then m.quantite else -m.quantite end), 0)
                                      as stock_actuel,
       l.date_peremption - r.date_reference as jours_avant_peremption,
       case when l.date_peremption <= r.date_reference then 'périmé'
            when l.date_peremption - r.date_reference <= 60 then 'à surveiller'
            else 'ok' end             as statut
from lot l
join produit p on p.produit_id = l.produit_id
join gold.v_date_reference r on r.coop_id = l.coop_id
left join mouvement_stock m on m.lot_id = l.lot_id
group by l.coop_id, p.code, p.famille, l.lot_id, l.numero, l.date_fabrication,
         l.date_peremption, l.quantite_initiale, r.date_reference;

-- Stock disponible par produit et couverture (en jours de ventes récentes)
create view gold.v_stock_produit as
with ventes_28j as (
    select v.coop_id, v.produit, sum(v.quantite) as ventes_28j
    from gold.v_ventes_jour v
    join gold.v_date_reference r on r.coop_id = v.coop_id
    where v.jour > r.date_reference - 28
    group by v.coop_id, v.produit
)
select s.coop_id,
       s.produit,
       s.famille,
       coalesce(sum(s.stock_actuel) filter (where s.statut <> 'périmé'), 0) as stock_disponible,
       count(*) filter (where s.statut <> 'périmé' and s.stock_actuel > 0)  as lots_actifs,
       coalesce(v.ventes_28j, 0)                                            as ventes_28j,
       round(coalesce(v.ventes_28j, 0) / 28.0, 2)                           as vente_moy_jour,
       round(sum(s.stock_actuel) filter (where s.statut <> 'périmé')
             / nullif(coalesce(v.ventes_28j, 0) / 28.0, 0))                 as couverture_jours
from gold.v_stock_lot s
left join ventes_28j v on v.coop_id = s.coop_id and v.produit = s.produit
group by s.coop_id, s.produit, s.famille, v.ventes_28j;

-- Risque d'invendus à une date donnée (logique « premier périmé, premier sorti ») :
-- unités d'un lot qui risquent de périmer = stock cumulé jusqu'à ce lot
--                                         − demande attendue avant sa péremption
-- La demande attendue est le rythme de vente des 28 jours précédant la date.
create or replace function gold.f_risque_invendus(p_date date)
returns table (coop_id uuid, produit text, famille text, lot text, date_peremption date,
               jours_avant_peremption integer, stock_actuel bigint, vente_moy_jour numeric,
               demande_avant_peremption numeric, unites_a_risque integer, valeur_a_risque_mad numeric)
language sql stable as $$
    with stock as (
        select l.coop_id, p.code as produit, p.famille, l.numero as lot, l.date_peremption, p.cout_mad,
               sum(case when m.type_mouvement = 'entree' then m.quantite else -m.quantite end) as stock_actuel
        from lot l
        join produit p on p.produit_id = l.produit_id
        join mouvement_stock m on m.lot_id = l.lot_id and m.date_mouvement::date <= p_date
        where l.date_peremption > p_date
        group by l.coop_id, p.code, p.famille, l.numero, l.date_peremption, p.cout_mad
        having sum(case when m.type_mouvement = 'entree' then m.quantite else -m.quantite end) > 0
    ),
    rythme as (
        select coop_id, produit, sum(quantite) / 28.0 as vente_moy_jour
        from gold.v_ventes_jour
        where jour > p_date - 28 and jour <= p_date
        group by coop_id, produit
    ),
    cumul as (
        select s.*, coalesce(r.vente_moy_jour, 0) as vente_moy_jour,
               sum(s.stock_actuel) over (partition by s.coop_id, s.produit
                                         order by s.date_peremption, s.lot) as stock_cumule
        from stock s
        left join rythme r on r.coop_id = s.coop_id and r.produit = s.produit
    )
    select coop_id, produit, famille, lot, date_peremption,
           (date_peremption - p_date)::int,
           stock_actuel,
           round(vente_moy_jour, 2),
           round(vente_moy_jour * (date_peremption - p_date)),
           greatest(0, least(stock_actuel,
                    round(stock_cumule - vente_moy_jour * (date_peremption - p_date))))::int,
           round(greatest(0, least(stock_actuel,
                    round(stock_cumule - vente_moy_jour * (date_peremption - p_date)))) * cout_mad, 2)
    from cumul
$$;

-- Le risque à la date de référence de chaque coopérative
create view gold.v_risque_invendus as
select f.*
from gold.v_date_reference r
cross join lateral gold.f_risque_invendus(r.date_reference) f
where f.coop_id = r.coop_id;

-- Pertes à la péremption, par mois et par produit
create or replace view gold.v_pertes_mensuelles as
select m.coop_id,
       date_trunc('month', m.date_mouvement)::date as mois,
       p.code                                       as produit,
       p.famille,
       sum(m.quantite)                              as unites_perimees,
       sum(m.quantite * p.cout_mad)                 as valeur_perdue_mad
from mouvement_stock m
join lot l using (lot_id)
join produit p on p.produit_id = l.produit_id
where m.type_mouvement = 'perte'
group by 1, 2, 3, 4;
