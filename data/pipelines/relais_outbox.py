"""
AgriCoop Intelligence — relais de l'outbox (PostgreSQL → Redpanda)

Lit les événements non publiés de la table `outbox`, les valide contre le contrat
`contracts/events/evenements.schema.json`, les publie dans le topic `agricoop.events`
(clé = coop_id), puis les marque comme publiés.

Garanties :
- Un événement non conforme au contrat (par exemple avec un téléphone) n'est JAMAIS publié.
  Il reste dans l'outbox et il est signalé à chaque passage.
- Livraison « au moins une fois » : si le relais s'arrête entre la publication et le
  marquage, l'événement sera republié. Les consommateurs dédoublonnent sur event_id.

Utilisation, depuis la racine du dépôt :
    python data/pipelines/relais_outbox.py --une-fois     # un seul passage
    python data/pipelines/relais_outbox.py                # en continu (Ctrl + C pour arrêter)
"""
import argparse
import json
import os
import sys
import time
from pathlib import Path

import psycopg2
from jsonschema import Draft202012Validator

RACINE = Path(__file__).resolve().parents[2]
CONTRAT = RACINE / "contracts" / "events" / "evenements.schema.json"

DSN = os.getenv("AGRICOOP_DSN", "host=localhost port=5433 dbname=agricoop user=agricoop password=agricoop_dev")
BROKERS = os.getenv("AGRICOOP_BROKERS", "localhost:19092")
TOPIC = os.getenv("AGRICOOP_TOPIC", "agricoop.events")
TAILLE_LOT = 500

validateur = Draft202012Validator(json.loads(CONTRAT.read_text(encoding="utf-8")))


def enveloppe(event_id, coop_id, type_, created_at, payload):
    return {"event_id": str(event_id), "coop_id": str(coop_id), "type": type_, "version": 1,
            "occurred_at": created_at.isoformat(), "payload": payload}


def un_passage(conn, producteur):
    """Publie un lot d'événements. Renvoie (publiés, rejetés)."""
    with conn, conn.cursor() as cur:   # une transaction : verrouille le lot pendant la publication
        cur.execute("""
            select event_id, coop_id, type, created_at, payload
            from outbox
            where not publie
            order by created_at
            limit %s
            for update skip locked""", (TAILLE_LOT,))
        lignes = cur.fetchall()

        publies, rejetes = [], 0
        for event_id, coop_id, type_, created_at, payload in lignes:
            evt = enveloppe(event_id, coop_id, type_, created_at, payload)
            erreurs = sorted(validateur.iter_errors(evt), key=lambda e: list(e.path))
            if erreurs:
                rejetes += 1
                print(f"  REJETÉ {event_id} ({type_}) : {erreurs[0].message}", file=sys.stderr)
                continue
            producteur.produce(TOPIC, key=str(coop_id).encode(),
                               value=json.dumps(evt, ensure_ascii=False).encode("utf-8"))
            publies.append(event_id)

        if publies:
            restants = producteur.flush(30)          # attend l'accusé de réception de Redpanda
            if restants:
                raise RuntimeError(f"{restants} événement(s) non confirmé(s) par Redpanda : rien n'est marqué")
            cur.execute("update outbox set publie = true where event_id = any(%s::uuid[])",
                        ([str(e) for e in publies],))
    return len(publies), rejetes


def creer_producteur():
    from confluent_kafka import Producer
    return Producer({"bootstrap.servers": BROKERS, "enable.idempotence": True, "acks": "all"})


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    parser.add_argument("--une-fois", action="store_true", help="un seul passage, puis arrêt")
    parser.add_argument("--intervalle", type=float, default=2.0, help="secondes entre deux passages")
    args = parser.parse_args()

    conn = psycopg2.connect(DSN)
    producteur = creer_producteur()
    print(f"Relais outbox → {TOPIC} ({BROKERS})")
    try:
        while True:
            publies, rejetes = un_passage(conn, producteur)
            if publies or rejetes or args.une_fois:
                print(f"{time.strftime('%H:%M:%S')}  publiés : {publies}  rejetés : {rejetes}")
            if args.une_fois:
                break
            time.sleep(args.intervalle)
    except KeyboardInterrupt:
        print("Arrêt du relais.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
