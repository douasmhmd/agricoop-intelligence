-- =============================================================================
-- Proposal 001 — row-level security (defense in depth for tenant isolation)
-- Status   : PROPOSED (needs approval from both CODEOWNERS)
-- Author   : apps
--
-- Rationale
--   The API already isolates tenants in code: every query goes through
--   withTenant(coopId, ...) (packages/db), which adds `coop_id = :coopId` to
--   each statement. RLS is a second, independent barrier: if a query ever
--   forgets that predicate, Postgres still only returns the caller's rows.
--
--   withTenant runs `SELECT set_config('app.coop_id', <coop_id>, true)` at the
--   start of each transaction; the policies below compare coop_id with it.
--   current_setting('app.coop_id', true) is NULL when unset, so a session that
--   did not set a tenant sees NO rows (fail closed).
--
-- Who is affected
--   * RLS is ENABLED but NOT FORCED: the table owner (`agricoop`) bypasses it.
--     The synthetic generator (data/synthetic-factory), schema setup and other
--     data-plane jobs that connect as the owner keep working unchanged.
--   * New role `agricoop_app` (no BYPASSRLS): the API, QR service and their
--     login users are members of it and are subject to the policies.
--   * New role `agricoop_relay` (no BYPASSRLS): the outbox relay reads and marks
--     events of ALL tenants, so it gets a dedicated policy on `outbox` only.
--   * Data-plane writers of `prevision` (write-back) should connect as the owner
--     or a role with BYPASSRLS.
--
-- Exceptions (not tenant-private, or needed before the tenant is known)
--   * `cooperative`: readable by every app session (code, nom, province are
--     public: storefront URLs use the code). Writes are platform-admin only and
--     authorised in the API.
--   * Public QR verification must find a code by token hash before it knows the
--     tenant: function qr_lookup(token_hash) is SECURITY DEFINER and returns
--     only (qr_id, coop_id); the service then continues inside withTenant.
--
-- Deployment
--   Login users are created per environment, e.g.
--     CREATE ROLE agricoop_api LOGIN PASSWORD '...' IN ROLE agricoop_app;
--     CREATE ROLE agricoop_relay_user LOGIN PASSWORD '...' IN ROLE agricoop_relay;
--   and the services' DATABASE_URL switches to them.
-- =============================================================================

-- --- Roles ---------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'agricoop_app') THEN
        CREATE ROLE agricoop_app NOLOGIN NOBYPASSRLS;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'agricoop_relay') THEN
        CREATE ROLE agricoop_relay NOLOGIN NOBYPASSRLS;
    END IF;
END $$;

GRANT USAGE ON SCHEMA public TO agricoop_app, agricoop_relay;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO agricoop_app;
GRANT SELECT, UPDATE ON outbox TO agricoop_relay;

-- --- Helper ----------------------------------------------------------------------
-- The tenant of the current transaction, or NULL when withTenant did not set it.
CREATE OR REPLACE FUNCTION app_current_coop() RETURNS uuid
    LANGUAGE sql STABLE
AS $$ SELECT NULLIF(current_setting('app.coop_id', true), '')::uuid $$;

-- --- Tenant-private tables: one policy per table -----------------------------------
DO $$
DECLARE
    tbl text;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'produit', 'lot', 'unite', 'qr_code', 'scan_qr', 'client', 'commande',
        'ligne_commande', 'mouvement_stock', 'prevision', 'outbox'
    ] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', tbl);
        EXECUTE format(
            'CREATE POLICY tenant_isolation ON %I TO agricoop_app '
            'USING (coop_id = app_current_coop()) '
            'WITH CHECK (coop_id = app_current_coop())', tbl);
    END LOOP;
END $$;

-- client_pii has no coop_id: visible only through a client of the current tenant.
ALTER TABLE client_pii ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON client_pii;
CREATE POLICY tenant_isolation ON client_pii TO agricoop_app
    USING (EXISTS (SELECT 1 FROM client c
                   WHERE c.client_id = client_pii.client_id
                     AND c.coop_id = app_current_coop()))
    WITH CHECK (EXISTS (SELECT 1 FROM client c
                        WHERE c.client_id = client_pii.client_id
                          AND c.coop_id = app_current_coop()));

-- cooperative: public read, writes authorised by the API (platform admin).
ALTER TABLE cooperative ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cooperative_read ON cooperative;
CREATE POLICY cooperative_read ON cooperative FOR SELECT TO agricoop_app USING (true);
DROP POLICY IF EXISTS cooperative_admin_write ON cooperative;
CREATE POLICY cooperative_admin_write ON cooperative FOR INSERT TO agricoop_app WITH CHECK (true);

-- outbox relay: reads and marks the events of every tenant.
DROP POLICY IF EXISTS relay_all ON outbox;
CREATE POLICY relay_all ON outbox TO agricoop_relay USING (true) WITH CHECK (true);

-- --- Public QR lookup ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION qr_lookup(p_token_hash text)
    RETURNS TABLE (qr_id uuid, coop_id uuid)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = public, pg_temp
AS $$ SELECT q.qr_id, q.coop_id FROM qr_code q WHERE q.token_hash = p_token_hash $$;

REVOKE ALL ON FUNCTION qr_lookup(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION qr_lookup(text) TO agricoop_app;
