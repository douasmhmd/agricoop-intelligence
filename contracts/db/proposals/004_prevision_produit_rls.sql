-- Proposal 004 — RLS for product-level AI forecasts
-- Requires proposal 001 and the prevision_produit migration.
-- Status: PROPOSED — requires CODEOWNERS approval.

-- Read-only access for the application role.
GRANT SELECT ON TABLE public.prevision_produit TO agricoop_app;

-- Additional PostgreSQL protection beyond TenantScope.
ALTER TABLE public.prevision_produit
    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation
    ON public.prevision_produit;

CREATE POLICY tenant_isolation
    ON public.prevision_produit
    FOR SELECT
    TO agricoop_app
    USING (
        coop_id = public.app_current_coop()
    );
