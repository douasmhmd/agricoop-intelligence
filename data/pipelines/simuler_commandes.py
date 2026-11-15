"""
AgriCoop Intelligence — simulateur de commandes pour la démonstration du pipeline

Reproduit exactement ce que fera l'application : pour chaque commande, UNE transaction
écrit la commande, sa ligne, la sortie de stock ET les événements de l'outbox
(commande_creee, stock_modifie). Le relais et la pseudonymisation prennent le relais.

Les commandes sont créées dans une coopérative de démonstration séparée (COOP-DEMO),
pour ne pas modifier les données de COOP01 (ni le manifeste, ni les vérifications BI).

Utilisation, depuis la racine du dépôt :
    python data/pipelines/simuler_commandes.py --nombre 20 --intervalle 1
    python data/pipelines/simuler_commandes.py --nettoyer     # supprime toute la démo
"""
import argparse
import json
import os
import random
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import psycopg2
from jsonschema import Draft202012Validator

RACINE = Path(__file__).resolve().parents[2]
validateur = Draft202012Validator(json.loads(
    (RACINE / "contracts" / "events" / "evenements.schema.json").read_text(encoding="utf-8")))
DSN = os.getenv("AGRICOOP_DSN", "host=localhost port=5433 dbname=agricoop user=agricoop password=agricoop_dev")
CODE_DEMO = "COOP-DEMO"
VILLES = ["Casablanca", "Rabat", "Tanger", "Ouezzane", "Fès", "Marrakech"]


def maintenant():
    return datetime.now(timezone.utc)


def outbox(cur, coop_id, type_, payload):
    evt = {"event_id": str(uuid.uuid4()), "coop_id": str(coop_id), "type": type_, "version": 1,
           "occurred_at": maintenant().isoformat(), "payload": payload}
    validateur.validate(evt)                 # l'application vérifie le contrat avant d'écrire
    cur.execute("insert into outbox (event_id, coop_id, type, payload) values (%s, %s, %s, %s)",
                (evt["event_id"], coop_id, type_, json.dumps(payload)))


def preparer_demo(cur):
    """Crée la coopérative de démo, un produit, un lot en stock et 15 clients (une seule fois)."""
    cur.execute("select coop_id from cooperative where code = %s", (CODE_DEMO,))
    ligne = cur.fetchone()
    if ligne:
        coop_id = ligne[0]
    else:
        cur.execute("""insert into cooperative (code, nom, province, is_synthetic)
                       values (%s, 'Coopérative démo pipeline', 'Ouezzane', true) returning coop_id""",
                    (CODE_DEMO,))
        coop_id = cur.fetchone()[0]
        cur.execute("""insert into produit (coop_id, code, nom, famille, categorie, prix_mad, cout_mad,
                                            conservation_j, huile_ml_par_unite, niveau_qr, is_synthetic)
                       values (%s, 'HVE-1L', 'Huile d''olive vierge extra 1 L', 'alimentaire', 'huile',
                               75, 42, 540, 1000, 'lot', true) returning produit_id""", (coop_id,))
        produit_id = cur.fetchone()[0]
        fab = maintenant().date() - timedelta(days=30)
        cur.execute("""insert into lot (coop_id, produit_id, numero, date_fabrication, date_peremption,
                                        quantite_initiale, is_synthetic)
                       values (%s, %s, 'DEMO-HVE-1L-001', %s, %s, 1000, true) returning lot_id""",
                    (coop_id, produit_id, fab, fab + timedelta(days=540)))
        lot_id = cur.fetchone()[0]
        cur.execute("""insert into mouvement_stock (coop_id, lot_id, type_mouvement, quantite, date_mouvement,
                                                    is_synthetic)
                       values (%s, %s, 'entree', 1000, %s, true) returning mouvement_id""",
                    (coop_id, lot_id, maintenant()))
        outbox(cur, coop_id, "stock_modifie", {
            "mouvement_id": str(cur.fetchone()[0]), "lot_id": str(lot_id), "produit_id": str(produit_id),
            "code_produit": "HVE-1L", "type_mouvement": "entree", "quantite": 1000,
            "date_mouvement": maintenant().isoformat()})
        for i in range(15):
            ville = random.choice(VILLES)
            cur.execute("""insert into client (coop_id, type_client, ville, date_inscription, is_synthetic)
                           values (%s, 'particulier', %s, %s, true) returning client_id""",
                        (coop_id, ville, maintenant().date()))
            cid = cur.fetchone()[0]
            cur.execute("""insert into client_pii (client_id, nom, telephone, email, adresse)
                           values (%s, %s, %s, %s, %s)""",
                        (cid, f"Client démo {i + 1}", f"06000000{i:02d}", f"demo{i + 1}@exemple.ma",
                         f"Adresse fictive, {ville}"))
    return coop_id


def passer_commande(conn, coop_id):
    with conn, conn.cursor() as cur:         # UNE transaction : la commande et ses événements
        cur.execute("select client_id, type_client, ville from client where coop_id = %s order by random() limit 1",
                    (coop_id,))
        client_id, type_client, ville = cur.fetchone()
        cur.execute("""select l.lot_id, p.produit_id, p.code, p.prix_mad
                       from lot l join produit p using (produit_id) where l.coop_id = %s limit 1""", (coop_id,))
        lot_id, produit_id, code, prix = cur.fetchone()
        quantite, date_cmd = random.randint(1, 3), maintenant()

        cur.execute("""insert into commande (coop_id, client_id, canal, date_commande, statut, is_synthetic)
                       values (%s, %s, 'web', %s, 'creee', true) returning commande_id""",
                    (coop_id, client_id, date_cmd))
        commande_id = cur.fetchone()[0]
        cur.execute("""insert into ligne_commande (coop_id, commande_id, produit_id, lot_id, quantite,
                                                   prix_unitaire_mad, is_synthetic)
                       values (%s, %s, %s, %s, %s, %s, true)""",
                    (coop_id, commande_id, produit_id, lot_id, quantite, prix))
        cur.execute("""insert into mouvement_stock (coop_id, lot_id, type_mouvement, quantite, date_mouvement,
                                                    is_synthetic)
                       values (%s, %s, 'sortie', %s, %s, true) returning mouvement_id""",
                    (coop_id, lot_id, quantite, date_cmd))
        mouvement_id = cur.fetchone()[0]

        outbox(cur, coop_id, "commande_creee", {
            "commande_id": str(commande_id), "client_id": str(client_id), "type_client": type_client,
            "ville": ville, "canal": "web", "date_commande": date_cmd.isoformat(),
            "lignes": [{"produit_id": str(produit_id), "code_produit": code, "lot_id": str(lot_id),
                        "quantite": quantite, "prix_unitaire_mad": float(prix)}]})
        outbox(cur, coop_id, "stock_modifie", {
            "mouvement_id": str(mouvement_id), "lot_id": str(lot_id), "produit_id": str(produit_id),
            "code_produit": code, "type_mouvement": "sortie", "quantite": quantite,
            "date_mouvement": date_cmd.isoformat()})
    return quantite


def nettoyer(conn):
    with conn, conn.cursor() as cur:
        cur.execute("select coop_id from cooperative where code = %s", (CODE_DEMO,))
        ligne = cur.fetchone()
        if not ligne:
            print("Aucune démo à nettoyer.")
            return
        c = ligne[0]
        cur.execute("delete from client_pii where client_id in (select client_id from client where coop_id = %s)", (c,))
        for table in ["outbox", "scan_qr", "qr_code", "unite", "mouvement_stock", "ligne_commande",
                      "commande", "client", "prevision", "lot", "produit", "cooperative"]:
            cur.execute(f"delete from {table} where coop_id = %s", (c,))
    print("Coopérative de démonstration supprimée (les fichiers bronze restent : supprime data/lake/ si besoin).")


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    parser.add_argument("--nombre", type=int, default=20)
    parser.add_argument("--intervalle", type=float, default=1.0, help="secondes entre deux commandes")
    parser.add_argument("--nettoyer", action="store_true")
    args = parser.parse_args()

    conn = psycopg2.connect(DSN)
    try:
        if args.nettoyer:
            nettoyer(conn)
            return
        with conn, conn.cursor() as cur:
            coop_id = preparer_demo(cur)
        print(f"Coopérative {CODE_DEMO} ({coop_id}) : {args.nombre} commandes, une toutes les {args.intervalle} s")
        for i in range(args.nombre):
            q = passer_commande(conn, coop_id)
            print(f"  commande {i + 1}/{args.nombre} : {q} × HVE-1L")
            time.sleep(args.intervalle)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
