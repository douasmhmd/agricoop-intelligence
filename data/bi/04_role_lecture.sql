-- =============================================================================
-- AgriCoop Intelligence — utilisateur en lecture seule pour l'API analytique
-- Fichier : data/bi/04_role_lecture.sql   (nécessite 01, 02 et 03)
-- Il ne voit QUE le schéma gold, jamais les tables de l'application (ni client_pii).
-- =============================================================================
do $$ begin
    if not exists (select from pg_roles where rolname = 'analytics_reader') then
        create role analytics_reader login password 'analytics_dev';   -- local uniquement
    end if;
end $$;

grant usage on schema gold to analytics_reader;
grant select on all tables in schema gold to analytics_reader;
alter default privileges in schema gold grant select on tables to analytics_reader;

-- La fonction de risque lit les tables de l'application : elle s'exécute avec les
-- droits de son propriétaire, pour que le lecteur n'ait pas besoin d'y accéder.
alter function gold.f_risque_invendus(date) security definer set search_path = public, gold;
