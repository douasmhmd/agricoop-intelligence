-- =============================================================================
-- AgriCoop Intelligence — schéma de la base opérationnelle (MVP)
-- Fichier : contracts/db/schema.sql
-- Cible   : PostgreSQL 14 ou plus récent
--
-- Conventions
--   * Chaque table métier porte coop_id : c'est l'identifiant du tenant.
--   * Chaque table métier porte is_synthetic : TRUE pour les données générées.
--   * Les données personnelles sont isolées dans client_pii ; elles ne quittent
--     jamais le plan opérationnel.
--   * Toute modification de ce fichier doit être validée par les deux membres
--     du binôme (voir .github/CODEOWNERS).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Coopératives (tenants)
-- -----------------------------------------------------------------------------
CREATE TABLE cooperative (
    coop_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code          TEXT NOT NULL UNIQUE,                 -- ex. COOP01
    nom           TEXT NOT NULL,
    province      TEXT NOT NULL,
    is_synthetic  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Catalogue des produits
-- -----------------------------------------------------------------------------
CREATE TABLE produit (
    produit_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coop_id             UUID NOT NULL REFERENCES cooperative (coop_id),
    code                TEXT NOT NULL,                  -- ex. HVE-1L
    nom                 TEXT NOT NULL,
    famille             TEXT NOT NULL
                        CHECK (famille IN ('alimentaire', 'cosmetique', 'coffret')),
    categorie           TEXT NOT NULL,                  -- ex. huile, olives_table, savon
    prix_mad            NUMERIC(10, 2) NOT NULL CHECK (prix_mad > 0),
    cout_mad            NUMERIC(10, 2) NOT NULL CHECK (cout_mad >= 0),
    conservation_j      INTEGER NOT NULL CHECK (conservation_j > 0),
    huile_ml_par_unite  INTEGER NOT NULL DEFAULT 0 CHECK (huile_ml_par_unite >= 0),
    niveau_qr           TEXT NOT NULL CHECK (niveau_qr IN ('lot', 'unite')),
    actif               BOOLEAN NOT NULL DEFAULT TRUE,
    is_synthetic        BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (coop_id, code)
);

-- -----------------------------------------------------------------------------
-- Lots de production et unités sérialisées
-- -----------------------------------------------------------------------------
CREATE TABLE lot (
    lot_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coop_id            UUID NOT NULL REFERENCES cooperative (coop_id),
    produit_id         UUID NOT NULL REFERENCES produit (produit_id),
    numero             TEXT NOT NULL,                   -- ex. HVE-1L-2026-001
    date_fabrication   DATE NOT NULL,
    date_peremption    DATE NOT NULL,
    quantite_initiale  INTEGER NOT NULL CHECK (quantite_initiale > 0),
    is_synthetic       BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (coop_id, numero),
    CHECK (date_peremption > date_fabrication)
);

-- Une ligne par bouteille ou coffret, uniquement pour les produits
-- dont niveau_qr = 'unite'.
CREATE TABLE unite (
    unite_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coop_id       UUID NOT NULL REFERENCES cooperative (coop_id),
    lot_id        UUID NOT NULL REFERENCES lot (lot_id),
    numero_serie  INTEGER NOT NULL CHECK (numero_serie > 0),
    is_synthetic  BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (lot_id, numero_serie)
);

-- -----------------------------------------------------------------------------
-- QR codes d'authenticité
-- Le jeton est aléatoire (128 bits) et n'est jamais stocké en clair :
-- on ne conserve que son empreinte SHA-256.
-- Un QR code est rattaché soit à un lot, soit à une unité, jamais aux deux.
-- -----------------------------------------------------------------------------
CREATE TABLE qr_code (
    qr_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coop_id       UUID NOT NULL REFERENCES cooperative (coop_id),
    token_hash    TEXT NOT NULL UNIQUE,
    niveau        TEXT NOT NULL CHECK (niveau IN ('lot', 'unite')),
    lot_id        UUID REFERENCES lot (lot_id),
    unite_id      UUID REFERENCES unite (unite_id),
    statut        TEXT NOT NULL DEFAULT 'actif'
                  CHECK (statut IN ('actif', 'desactive', 'signale')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_synthetic  BOOLEAN NOT NULL DEFAULT FALSE,
    CHECK (
        (niveau = 'lot'   AND lot_id   IS NOT NULL AND unite_id IS NULL)
     OR (niveau = 'unite' AND unite_id IS NOT NULL AND lot_id   IS NULL)
    )
);

CREATE TABLE scan_qr (
    scan_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coop_id       UUID NOT NULL REFERENCES cooperative (coop_id),
    qr_id         UUID NOT NULL REFERENCES qr_code (qr_id),
    date_scan     TIMESTAMPTZ NOT NULL,
    ville         TEXT,                                 -- ville approximative
    appareil      TEXT,
    is_synthetic  BOOLEAN NOT NULL DEFAULT FALSE
);

-- -----------------------------------------------------------------------------
-- Clients
-- client     : données non personnelles, exploitables pour l'analytique.
-- client_pii : données personnelles, isolées. Elles ne sortent jamais vers
--              le plan analytique.
-- -----------------------------------------------------------------------------
CREATE TABLE client (
    client_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coop_id           UUID NOT NULL REFERENCES cooperative (coop_id),
    type_client       TEXT NOT NULL CHECK (type_client IN ('particulier', 'revendeur')),
    ville             TEXT NOT NULL,
    date_inscription  DATE NOT NULL,
    is_synthetic      BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE client_pii (
    client_id  UUID PRIMARY KEY REFERENCES client (client_id) ON DELETE CASCADE,
    nom        TEXT NOT NULL,
    telephone  TEXT,
    email      TEXT,
    adresse    TEXT
);

-- -----------------------------------------------------------------------------
-- Commandes
-- -----------------------------------------------------------------------------
CREATE TABLE commande (
    commande_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coop_id        UUID NOT NULL REFERENCES cooperative (coop_id),
    client_id      UUID NOT NULL REFERENCES client (client_id),
    canal          TEXT NOT NULL CHECK (canal IN ('web', 'revendeur', 'direct')),
    date_commande  TIMESTAMPTZ NOT NULL,
    statut         TEXT NOT NULL
                   CHECK (statut IN ('creee', 'payee', 'expediee', 'livree', 'annulee')),
    is_synthetic   BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE ligne_commande (
    ligne_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coop_id            UUID NOT NULL REFERENCES cooperative (coop_id),
    commande_id        UUID NOT NULL REFERENCES commande (commande_id) ON DELETE CASCADE,
    produit_id         UUID NOT NULL REFERENCES produit (produit_id),
    lot_id             UUID REFERENCES lot (lot_id),
    quantite           INTEGER NOT NULL CHECK (quantite > 0),
    prix_unitaire_mad  NUMERIC(10, 2) NOT NULL CHECK (prix_unitaire_mad > 0),
    is_synthetic       BOOLEAN NOT NULL DEFAULT FALSE
);

-- -----------------------------------------------------------------------------
-- Mouvements de stock (par lot)
-- Le stock d'un lot = somme des entrées - somme des sorties et des pertes.
-- -----------------------------------------------------------------------------
CREATE TABLE mouvement_stock (
    mouvement_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coop_id         UUID NOT NULL REFERENCES cooperative (coop_id),
    lot_id          UUID NOT NULL REFERENCES lot (lot_id),
    type_mouvement  TEXT NOT NULL CHECK (type_mouvement IN ('entree', 'sortie', 'perte')),
    quantite        INTEGER NOT NULL CHECK (quantite > 0),
    date_mouvement  TIMESTAMPTZ NOT NULL,
    is_synthetic    BOOLEAN NOT NULL DEFAULT FALSE
);

-- -----------------------------------------------------------------------------
-- Prévisions (write-back)
-- Table remplie par le plan analytique et affichée par le backoffice.
-- -----------------------------------------------------------------------------
CREATE TABLE prevision (
    coop_id          UUID NOT NULL REFERENCES cooperative (coop_id),
    famille          TEXT NOT NULL,
    semaine          DATE NOT NULL,                     -- lundi de la semaine prévue
    quantite_prevue  NUMERIC(12, 2) NOT NULL CHECK (quantite_prevue >= 0),
    version_modele   TEXT NOT NULL,
    date_calcul      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (coop_id, famille, semaine, version_modele)
);

-- -----------------------------------------------------------------------------
-- Outbox transactionnelle
-- L'application écrit ici, dans la même transaction que l'écriture métier,
-- l'événement à publier vers le courtier d'événements.
-- -----------------------------------------------------------------------------
CREATE TABLE outbox (
    event_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coop_id     UUID NOT NULL REFERENCES cooperative (coop_id),
    type        TEXT NOT NULL,          -- ex. commande_creee, stock_modifie, qr_scanne
    payload     JSONB NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    publie      BOOLEAN NOT NULL DEFAULT FALSE
);

-- -----------------------------------------------------------------------------
-- Index
-- -----------------------------------------------------------------------------
CREATE INDEX idx_produit_coop          ON produit (coop_id);
CREATE INDEX idx_lot_produit           ON lot (produit_id);
CREATE INDEX idx_lot_peremption        ON lot (coop_id, date_peremption);
CREATE INDEX idx_unite_lot             ON unite (lot_id);
CREATE INDEX idx_scan_qr               ON scan_qr (qr_id, date_scan);
CREATE INDEX idx_client_coop           ON client (coop_id);
CREATE INDEX idx_commande_coop_date    ON commande (coop_id, date_commande);
CREATE INDEX idx_ligne_commande        ON ligne_commande (commande_id);
CREATE INDEX idx_ligne_produit         ON ligne_commande (produit_id);
CREATE INDEX idx_mouvement_lot         ON mouvement_stock (lot_id, date_mouvement);
CREATE INDEX idx_outbox_a_publier      ON outbox (created_at) WHERE NOT publie;
