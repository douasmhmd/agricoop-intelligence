"""
AgriCoop Intelligence — pseudonymisation (agricoop.events → agricoop.events.pseudo + bronze)

Consomme les événements bruts, remplace l'identifiant du client par un jeton à clé
(HMAC-SHA256), vérifie qu'aucune donnée personnelle ne sort, puis :
  - publie l'événement dans le topic agricoop.events.pseudo ;
  - l'écrit dans data/lake/bronze/ (fichiers JSON Lines par jour), qui joue le rôle
    d'ADLS Gen2 en attendant Azure.

La clé secrète est lue dans la variable d'environnement AGRICOOP_CLE_PSEUDO.
Sans clé, le service refuse de démarrer : il n'y a pas de clé par défaut.
En production, elle vient d'OCI Vault et ne quitte jamais le Maroc.

Utilisation, depuis la racine du dépôt :
    python data/pipelines/pseudonymiseur.py --une-fois   # vide le topic puis s'arrête
    python data/pipelines/pseudonymiseur.py              # en continu (Ctrl + C pour arrêter)
"""
import argparse
import hashlib
import hmac
import json
import os
import sys
from pathlib import Path

from jsonschema import Draft202012Validator

RACINE = Path(__file__).resolve().parents[2]
CONTRAT = RACINE / "contracts" / "events" / "evenements.schema.json"
BRONZE = Path(os.getenv("AGRICOOP_BRONZE", RACINE / "data" / "lake" / "bronze"))

BROKERS = os.getenv("AGRICOOP_BROKERS", "localhost:19092")
TOPIC_ENTREE = "agricoop.events"
TOPIC_SORTIE = "agricoop.events.pseudo"
CHAMPS_INTERDITS = {"nom", "telephone", "email", "adresse", "client_id", "token", "jeton"}

validateur = Draft202012Validator(json.loads(CONTRAT.read_text(encoding="utf-8")))


def lire_cle():
    cle = os.getenv("AGRICOOP_CLE_PSEUDO")
    if not cle or len(cle) < 32:
        sys.exit("AGRICOOP_CLE_PSEUDO absente ou trop courte (32 caractères minimum) : arrêt.")
    return cle.encode()


def jeton(cle, valeur):
    """Jeton stable et non réversible sans la clé : le même client donne toujours le même jeton."""
    return hmac.new(cle, str(valeur).encode(), hashlib.sha256).hexdigest()


def cles_imbriquees(obj):
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield k
            yield from cles_imbriquees(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from cles_imbriquees(v)


def pseudonymiser(evt, cle):
    """Renvoie l'événement pseudonymisé, ou lève ValueError s'il ne doit pas sortir."""
    erreurs = list(validateur.iter_errors(evt))
    if erreurs:                                   # seconde barrière, après celle du relais
        raise ValueError(f"non conforme au contrat : {erreurs[0].message}")
    sortie = json.loads(json.dumps(evt))
    p = sortie["payload"]
    if "client_id" in p:
        p["client_jeton"] = jeton(cle, p.pop("client_id"))
    interdits = CHAMPS_INTERDITS & set(cles_imbriquees(sortie))
    if interdits:
        raise ValueError(f"champ interdit après pseudonymisation : {sorted(interdits)}")
    sortie["pseudonymise"] = True
    return sortie


def ecrire_bronze(evt):
    dossier = BRONZE / f"date={evt['occurred_at'][:10]}"
    dossier.mkdir(parents=True, exist_ok=True)
    with open(dossier / "evenements.jsonl", "a", encoding="utf-8") as f:
        f.write(json.dumps(evt, ensure_ascii=False) + "\n")


def creer_clients():
    from confluent_kafka import Consumer, Producer
    consommateur = Consumer({"bootstrap.servers": BROKERS, "group.id": "pseudonymisation",
                             "auto.offset.reset": "earliest", "enable.auto.commit": False})
    producteur = Producer({"bootstrap.servers": BROKERS, "enable.idempotence": True, "acks": "all"})
    return consommateur, producteur


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    parser.add_argument("--une-fois", action="store_true", help="s'arrête quand le topic est vide")
    args = parser.parse_args()

    cle = lire_cle()
    consommateur, producteur = creer_clients()
    consommateur.subscribe([TOPIC_ENTREE])
    print(f"Pseudonymisation {TOPIC_ENTREE} → {TOPIC_SORTIE} + {BRONZE}")
    traites = rejetes = vides = 0
    try:
        while True:
            msg = consommateur.poll(1.0)
            if msg is None:
                vides += 1
                if args.une_fois and vides >= 5:          # 5 secondes sans message
                    break
                continue
            vides = 0
            if msg.error():
                print(f"  erreur Redpanda : {msg.error()}", file=sys.stderr)
                continue
            evt = json.loads(msg.value())
            try:
                sortie = pseudonymiser(evt, cle)
            except ValueError as e:
                rejetes += 1
                print(f"  REJETÉ {evt.get('event_id')} : {e}", file=sys.stderr)
            else:
                producteur.produce(TOPIC_SORTIE, key=msg.key(),
                                   value=json.dumps(sortie, ensure_ascii=False).encode("utf-8"))
                if producteur.flush(30):
                    raise RuntimeError("publication non confirmée par Redpanda : arrêt sans valider l'offset")
                ecrire_bronze(sortie)
                traites += 1
            consommateur.commit(message=msg, asynchronous=False)   # après traitement : au moins une fois
    except KeyboardInterrupt:
        pass
    finally:
        consommateur.close()
        print(f"Pseudonymisés : {traites}  rejetés : {rejetes}")


if __name__ == "__main__":
    main()
