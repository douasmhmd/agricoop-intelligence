# MANTIS — Prédiction des durées de manœuvre des porte-conteneurs (Tanger Med)

Système MLOps selon le patron **FTI (Feature – Training – Inference)**, construit avec Kedro.
Quatre pipelines, quatre modèles, une API événementielle, deux interfaces, un monitoring de dérive.

## Résultats (validation temporelle, holdout 2024-07 → 2025-07)

| Cible | Livrable | Score |
|---|---|---|
| B accostage | valeur | R² 0,53 · MAE 8,7 min (baseline 13,7) |
| A approche | intervalle 80 % (CQR) | couverture 81 % · largeur 126 min (naïf 150) |
| C appareillage | valeur | MAE 9,1 min · biais −4,8 → réentraînement déclenché |
| D transit | valeur | MAE 2,7 min (plancher de saisie) |

## Architecture

```
data/01_raw  ──▶ feature ──▶ data/04_feature ──▶ training ──▶ data/06_models + MLflow
                                   │                                   │
                                   └──────────▶ inference ◀────────────┘
                                                    │
                                                    ▼
                                    monitoring ──▶ data/08_reporting (Evidently, décision)
API FastAPI (/predict, /narrate, /journal)  ·  UI opérateur  ·  Backoffice admin
```

## Démarrage rapide (local)

```bash
pip install -r requirements.txt && pip install -e .
copy data\01_raw\vessel_containers.csv          # export PMS TMPA (non versionné)
kedro run                                       # feature → training → inference → monitoring (~3 min)
run_local.bat                                   # API + UIs + MLflow
```

- API : http://127.0.0.1:8000/docs
- Opérateur : http://localhost:8501 — Backoffice : http://localhost:8502 — MLflow : http://localhost:5000
- `kedro viz run` : DAG des pipelines

## Démarrage Docker

```bash
cp .env.example .env            # clé OpenAI (facultative : sans clé, gabarit déterministe)
docker compose up --build       # mlflow · api · operator · admin
docker compose run --rm pipelines kedro run --pipeline feature
```

## Pipelines

| Pipeline | Nodes | Sorties |
|---|---|---|
| `feature` | clean_raw → build_manoeuvres → split_filter → add_context → add_history → validate_select | `features_entree/sortie.parquet` (validés Pandera) |
| `training` | rolling_eval → train_B / train_A_cqr / train_sortie → register_mlflow | 4 modèles, `metrics_rolling.csv`, `metrics_holdout.json`, registre MLflow |
| `inference` | score_entree, score_sortie | `predictions_*.parquet` (holdout scoré) |
| `monitoring` | rolling_performance → data_drift_report → decide_retrain | `evidently_drift.html`, `monitoring_rolling.csv`, `monitoring_decision.json` |

## Inférence événementielle

La prédiction se précise à chaque horodatage du PMS :

| Événement | Ce qui est prédit |
|---|---|
| `ETA`, `PORT_LIMIT` | fin de manœuvre en **intervalle** (A conformal + B) + risque d'attente |
| `PILOT_ONBOARD` | accostage à ±8 min (navigation ≈ 26 min) + B |
| `JETTY` | fin de manœuvre à ±9 min (B seul) |
| `DEPARTURE_REQUEST` | sortie de la limite portuaire (C + D) |

## Souveraineté et minimisation

Le LLM de reformulation ne reçoit qu'un JSON à liste blanche (`mantis/narrate.py::ALLOWED`) :
durées, catégories, indicateurs — jamais d'IMO, de nom de navire, d'agent, de pilote, d'horodatage.
Fallback déterministe si l'API est indisponible. Cible V2 : LLM local (vLLM) on-premise.

## Structure

```
conf/base/{catalog,parameters*}.yml   configuration (seuils justifiés par l'EDA)
src/mantis/pipelines/{feature,training,inference,monitoring}/
src/mantis/{schemas,models,inference,narrate}.py
api/main.py · ui/operator.py · ui/admin.py
data/08_reporting/                    artefacts de rapport
```

## Recommandations à TMPA (issues de l'analyse)

1. Enregistrer le début réel de la manœuvre d'entrée (embarquement du pilote), séparément de `PortLimitArrival`.
2. Conserver l'heure d'affectation *prévue* du pilote (`Resource_EstimatedStartDate` ne doit plus être écrasé).
3. Croiser avec la météo horaire (vent) — cause probable des attentes inexpliquées.
