-- =============================================================================
-- DEV / DEMO ONLY — catalogue, stock, QR codes and a few orders for COOP02.
--
-- Run by the `db-seed` service of docker-compose.apps.yml (after 001), or again with
-- `pnpm db:seed`. Idempotent: fixed ids, ON CONFLICT DO NOTHING. Every row is is_synthetic = true.
--
-- COOP01 is left to the synthetic generator (data/synthetic-factory), which owns all COOP01 rows
-- and validates them; do not add COOP01 rows here.
--
-- Dates are relative to the day the seed first runs, so a fresh demo always has fresh stock, one
-- lot close to expiry (30-day alert) and one expired lot (skipped by FEFO).
--
-- Demo QR tokens (printed nowhere, for demos only — real tokens are random and never stored):
--   /v/DemoToken1234567890Abc   lot HVE-1L-DEMO-A, actif   → "Authentique"
--   /v/DemoTokenSignale000001   lot SAV-100G-DEMO-A, signale → "Attention"
-- Only sha256(token) is stored, as the QR service does.
-- =============================================================================

\set coop '''22222222-2222-4222-8222-222222222222''::uuid'

BEGIN;

-- Products (codes follow the generator's catalogue). If a product with the same code already
-- exists for COOP02 it is kept as is.
INSERT INTO produit (produit_id, coop_id, code, nom, famille, categorie, prix_mad, cout_mad,
                     conservation_j, huile_ml_par_unite, niveau_qr, is_synthetic)
VALUES
    ('d2a00000-0000-4000-8000-000000000001', :coop, 'HVE-1L', 'Huile d''olive vierge extra 1 L', 'alimentaire', 'huile', 80.00, 44.00, 540, 1000, 'lot', TRUE),
    ('d2a00000-0000-4000-8000-000000000002', :coop, 'HVE-5L', 'Huile d''olive vierge extra 5 L', 'alimentaire', 'huile', 360.00, 205.00, 540, 5000, 'unite', TRUE),
    ('d2a00000-0000-4000-8000-000000000003', :coop, 'OVC-1KG', 'Olives vertes cassées 1 kg', 'alimentaire', 'olives_table', 32.00, 16.50, 365, 0, 'lot', TRUE),
    ('d2a00000-0000-4000-8000-000000000004', :coop, 'ON-1KG', 'Olives noires 1 kg', 'alimentaire', 'olives_table', 36.00, 19.00, 365, 0, 'lot', TRUE),
    ('d2a00000-0000-4000-8000-000000000005', :coop, 'SAV-100G', 'Savon solide à l''huile d''olive 100 g', 'cosmetique', 'savon', 15.00, 7.50, 730, 60, 'lot', TRUE),
    ('d2a00000-0000-4000-8000-000000000006', :coop, 'COF-CAD', 'Coffret cadeau découverte', 'coffret', 'coffret', 220.00, 120.00, 365, 300, 'unite', TRUE)
ON CONFLICT DO NOTHING;

-- Lots: (lot id, product code, numero, made N days ago, expires in M days, quantity).
INSERT INTO lot (lot_id, coop_id, produit_id, numero, date_fabrication, date_peremption,
                 quantite_initiale, is_synthetic)
SELECT l.lot_id::uuid, :coop, p.produit_id, l.numero,
       CURRENT_DATE - l.fab_il_y_a, CURRENT_DATE + l.perime_dans, l.quantite, TRUE
FROM (VALUES
    ('d2b00000-0000-4000-8000-000000000001', 'HVE-1L',   'HVE-1L-DEMO-A',   60,  480, 120),
    ('d2b00000-0000-4000-8000-000000000002', 'HVE-1L',   'HVE-1L-DEMO-B',   10,  530,  80),
    ('d2b00000-0000-4000-8000-000000000003', 'HVE-5L',   'HVE-5L-DEMO-A',   60,  480,  30),
    ('d2b00000-0000-4000-8000-000000000004', 'OVC-1KG',  'OVC-1KG-DEMO-A', 340,   25,  40), -- expires in 25 days
    ('d2b00000-0000-4000-8000-000000000005', 'OVC-1KG',  'OVC-1KG-DEMO-B',  20,  345,  60),
    ('d2b00000-0000-4000-8000-000000000006', 'ON-1KG',   'ON-1KG-DEMO-A',  370,   -5,  15), -- expired
    ('d2b00000-0000-4000-8000-000000000007', 'ON-1KG',   'ON-1KG-DEMO-B',   15,  350,  50),
    ('d2b00000-0000-4000-8000-000000000008', 'SAV-100G', 'SAV-100G-DEMO-A', 45,  685, 200),
    ('d2b00000-0000-4000-8000-000000000009', 'COF-CAD',  'COF-CAD-DEMO-A',  30,  335,  20)
) AS l (lot_id, code, numero, fab_il_y_a, perime_dans, quantite)
JOIN produit p ON p.coop_id = :coop AND p.code = l.code
ON CONFLICT DO NOTHING;

-- Stock in: one entry per lot, on its production day.
INSERT INTO mouvement_stock (mouvement_id, coop_id, lot_id, type_mouvement, quantite,
                             date_mouvement, is_synthetic)
SELECT ('d2c00000-0000-4000-8000-' || substr(l.lot_id::text, 25))::uuid,
       :coop, l.lot_id, 'entree', l.quantite_initiale,
       l.date_fabrication + TIME '09:00', TRUE
FROM lot l
WHERE l.coop_id = :coop AND l.numero LIKE '%-DEMO-%'
ON CONFLICT DO NOTHING;

-- A breakage on the soap lot.
INSERT INTO mouvement_stock (mouvement_id, coop_id, lot_id, type_mouvement, quantite,
                             date_mouvement, is_synthetic)
VALUES ('d2c00000-0000-4000-8000-000000000100', :coop, 'd2b00000-0000-4000-8000-000000000008',
        'perte', 6, (CURRENT_DATE - 20) + TIME '11:00', TRUE)
ON CONFLICT DO NOTHING;

-- Lot-level QR codes with known demo tokens (hash = hex(sha256(token)), like the QR service).
INSERT INTO qr_code (qr_id, coop_id, token_hash, niveau, lot_id, statut, is_synthetic)
VALUES
    ('d2d00000-0000-4000-8000-000000000001', :coop,
     encode(sha256(convert_to('DemoToken1234567890Abc', 'UTF8')), 'hex'),
     'lot', 'd2b00000-0000-4000-8000-000000000001', 'actif', TRUE),
    ('d2d00000-0000-4000-8000-000000000002', :coop,
     encode(sha256(convert_to('DemoTokenSignale000001', 'UTF8')), 'hex'),
     'lot', 'd2b00000-0000-4000-8000-000000000008', 'signale', TRUE)
ON CONFLICT DO NOTHING;

-- Customers (fictitious) and their orders: one delivered, one shipped, one paid.
INSERT INTO client (client_id, coop_id, type_client, ville, date_inscription, is_synthetic)
VALUES
    ('d2e00000-0000-4000-8000-000000000001', :coop, 'particulier', 'Fès', CURRENT_DATE - 40, TRUE),
    ('d2e00000-0000-4000-8000-000000000002', :coop, 'revendeur', 'Casablanca', CURRENT_DATE - 35, TRUE)
ON CONFLICT DO NOTHING;

INSERT INTO client_pii (client_id, nom, telephone, email, adresse)
VALUES
    ('d2e00000-0000-4000-8000-000000000001', 'Client démo (fictif)', NULL, 'client.demo@example.invalid', 'Fès'),
    ('d2e00000-0000-4000-8000-000000000002', 'Épicerie démo (fictive)', NULL, 'revendeur.demo@example.invalid', 'Casablanca')
ON CONFLICT DO NOTHING;

INSERT INTO commande (commande_id, coop_id, client_id, canal, date_commande, statut, is_synthetic)
VALUES
    ('d2f00000-0000-4000-8000-000000000001', :coop, 'd2e00000-0000-4000-8000-000000000001', 'web',
     (CURRENT_DATE - 21) + TIME '10:15', 'livree', TRUE),
    ('d2f00000-0000-4000-8000-000000000002', :coop, 'd2e00000-0000-4000-8000-000000000002', 'revendeur',
     (CURRENT_DATE - 6) + TIME '16:40', 'expediee', TRUE),
    ('d2f00000-0000-4000-8000-000000000003', :coop, 'd2e00000-0000-4000-8000-000000000001', 'web',
     (CURRENT_DATE - 1) + TIME '19:05', 'payee', TRUE)
ON CONFLICT DO NOTHING;

-- Lines (allocated FEFO: the oldest valid lot first) and the matching stock exits.
INSERT INTO ligne_commande (ligne_id, coop_id, commande_id, produit_id, lot_id, quantite,
                            prix_unitaire_mad, is_synthetic)
SELECT x.ligne_id::uuid, :coop, x.commande_id::uuid, l.produit_id, l.lot_id, x.quantite,
       x.prix::numeric(10, 2), TRUE
FROM (VALUES
    ('d2000000-0000-4000-8000-000000000001', 'd2f00000-0000-4000-8000-000000000001', 'd2b00000-0000-4000-8000-000000000001', 2,  '80.00'),
    ('d2000000-0000-4000-8000-000000000002', 'd2f00000-0000-4000-8000-000000000001', 'd2b00000-0000-4000-8000-000000000008', 3,  '15.00'),
    ('d2000000-0000-4000-8000-000000000003', 'd2f00000-0000-4000-8000-000000000002', 'd2b00000-0000-4000-8000-000000000004', 12, '25.60'),
    ('d2000000-0000-4000-8000-000000000004', 'd2f00000-0000-4000-8000-000000000002', 'd2b00000-0000-4000-8000-000000000001', 10, '64.00'),
    ('d2000000-0000-4000-8000-000000000005', 'd2f00000-0000-4000-8000-000000000003', 'd2b00000-0000-4000-8000-000000000009', 1,  '220.00')
) AS x (ligne_id, commande_id, lot_id, quantite, prix)
JOIN lot l ON l.lot_id = x.lot_id::uuid
ON CONFLICT DO NOTHING;

INSERT INTO mouvement_stock (mouvement_id, coop_id, lot_id, type_mouvement, quantite,
                             date_mouvement, is_synthetic)
-- Exit ids use the 8001 group so they never collide with the entry ids (8000) above.
SELECT ('d2c00000-0000-4000-8001-' || substr(lc.ligne_id::text, 25))::uuid,
       :coop, lc.lot_id, 'sortie', lc.quantite, c.date_commande, TRUE
FROM ligne_commande lc
JOIN commande c ON c.commande_id = lc.commande_id
WHERE lc.ligne_id::text LIKE 'd2000000-%'
ON CONFLICT DO NOTHING;

COMMIT;
