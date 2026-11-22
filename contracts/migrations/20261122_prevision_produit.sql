-- AgriCoop : prévisions hebdomadaires par produit

CREATE TABLE IF NOT EXISTS public.prevision_produit (
    coop_id UUID NOT NULL,
    produit_id UUID NOT NULL REFERENCES public.produit(produit_id),
    semaine DATE NOT NULL,
    type_prevision TEXT NOT NULL,
    quantite_prevue NUMERIC(12,2) NOT NULL
        CHECK (quantite_prevue >= 0),
    version_modele TEXT NOT NULL,
    date_calcul TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (coop_id, produit_id, semaine, type_prevision)
);

CREATE OR REPLACE VIEW public.v_prevision_produit_backoffice AS
SELECT
    pp.coop_id,
    pp.produit_id,
    p.code AS code_produit,
    p.nom AS nom_produit,
    p.famille,
    pp.semaine,
    pp.quantite_prevue,
    pp.type_prevision,
    pp.version_modele,
    pp.date_calcul
FROM public.prevision_produit pp
JOIN public.produit p
  ON p.produit_id = pp.produit_id
 AND p.coop_id = pp.coop_id;
