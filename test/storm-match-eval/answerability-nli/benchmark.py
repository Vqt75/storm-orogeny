"""Orchestrate development calibration and one sealed NLI holdout pass."""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

from artifacts import validate_artifact
from calibration import calibrate, objective
from common import validate_payload

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[2]
RETRIEVERS = ("e5-small", "distiluse-cased-v2")
NLI_MODELS = ("nli-minilm-l6", "nli-mdeberta-base")
REPRESENTATIONS = ("question", "questionAnswer")
DIRECTIONS = ("knowledgeToQuery", "queryToKnowledge")


def parse_mapping(value: str) -> tuple[str, Path]:
    key, separator, raw_path = value.partition("=")
    if not separator or not raw_path:
        raise argparse.ArgumentTypeError("Expected key=absolute-path")
    return key, Path(raw_path)


def offline_environment() -> dict[str, str]:
    environment = os.environ.copy()
    environment.update({
        "HF_HUB_OFFLINE": "1", "TRANSFORMERS_OFFLINE": "1", "HF_DATASETS_OFFLINE": "1",
        "HF_HUB_DISABLE_TELEMETRY": "1", "TOKENIZERS_PARALLELISM": "false",
        "PYTHONDONTWRITEBYTECODE": "1",
    })
    return environment


def run(command: list[str]) -> None:
    completed = subprocess.run(command, cwd=REPO_ROOT, env=offline_environment(), text=True, encoding="utf-8")
    if completed.returncode:
        raise RuntimeError(f"Worker failed ({completed.returncode}): {' '.join(command[:3])}")


def export_payload(node: str, phase: str, output: Path) -> dict[str, Any]:
    completed = subprocess.run(
        [node, str(HERE / "export-input.mjs"), phase], cwd=REPO_ROOT,
        capture_output=True, text=True, encoding="utf-8", check=True,
    )
    payload = json.loads(completed.stdout)
    validate_payload(payload, phase)
    output.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    return payload


def pct(value: int, total: int) -> str:
    return f"{value}/{total} ({100 * value / total:.1f}%)" if total else "n/a"


def probability_text(item: dict[str, Any]) -> str:
    candidates = item["candidates"][:3]
    return "; ".join(
        f"{candidate['entryId']} E/N/C={candidate['nli']['entailment']:.3f}/{candidate['nli']['neutral']:.3f}/{candidate['nli']['contradiction']:.3f}"
        for candidate in candidates
    )


def examples(metrics: dict[str, Any], predicate, limit: int = 5) -> list[str]:
    selected = [item for item in metrics["results"] if predicate(item)][:limit]
    if not selected:
        return ["- Aucun."]
    return [
        f"- `{item['case']['id']}` — {item['case']['formulation']} — attendu `{item['case'].get('expectedEntryId') or item['case']['label']}`, "
        f"prédit `{item['predictedLabel']}` / `{item.get('matchedEntryId')}` — {probability_text(item)}."
        for item in selected
    ]


def selected_for_direction(combinations: list[dict[str, Any]], model_key: str, direction: str) -> dict[str, Any]:
    candidates = [item for item in combinations if item["modelKey"] == model_key and item["direction"] == direction]
    return max(candidates, key=lambda item: objective(item["calibration"]["selected"]))


def render_report(raw: dict[str, Any]) -> str:
    development = raw["development"]
    retrievals = raw["retrievals"]
    nli_outputs = raw["nliOutputs"]
    combinations = raw["combinations"]
    selections = raw["lockedSelections"]
    holdouts = raw["holdouts"]
    latency = raw["latency"]
    lines = [
        "# Storm Match — Answerability NLI spike", "",
        f"- Corpus canonique : 112 Q&A; baseline officielle inchangée `{development['corpusFingerprint']}`.",
        f"- Development : 200 cas de l’ancien Decision Corpus observé `{development['priorDecisionFingerprint']}` — 100 covered, 80 notCovered, 20 ambiguous.",
        f"- Nouveau holdout scellé avant toute inférence : `{raw['answerabilityHoldoutFingerprint']}` — 96 cas équilibrés 32/32/32.",
        "- Les configurations et seuils ci-dessous ont été verrouillés sur development avant export du holdout. Le holdout a été exécuté une seule fois par modèle NLI.",
        "- CPU uniquement; snapshots locaux épinglés; Transformers/Hugging Face offline; aucun reranker BGE, lexical, génération ou code produit.",
        "", "## Artefacts NLI", "",
        "| modèle | révision | paramètres | artefact | fingerprint artefact | poids SHA-256 | licence |",
        "|---|---|---:|---:|---|---|---|",
    ]
    for model_key in NLI_MODELS:
        artifact = nli_outputs[model_key]["artifact"]
        lines.append(
            f"| `{artifact['modelId']}` | `{artifact['revision']}` | {artifact['parameters']:,} | "
            f"{artifact['artifactBytes'] / 1024 / 1024:.2f} MiB | `{artifact['artifactFingerprint']}` | "
            f"`{artifact['weightSha256']}` | {artifact['license']} |"
        )
    lines.extend([
        "", "## Retrieval development — 100 cas covered", "",
        "| retriever | représentation | Recall@1 | Recall@3 | Recall@5 |",
        "|---|---|---:|---:|---:|",
    ])
    for retriever_key in RETRIEVERS:
        for representation in REPRESENTATIONS:
            metric = retrievals[retriever_key]["representations"][representation]["metrics"]
            lines.append(
                f"| `{retriever_key}` | `{representation}` | {pct(metric['recallAt1'], 100)} | "
                f"{pct(metric['recallAt3'], 100)} | {pct(metric['recallAt5'], 100)} |"
            )
    lines.extend([
        "", "## Ablation directionnelle sur development", "",
        "Chaque ligne est la meilleure configuration sûre de cette direction. Les directions ne sont pas fusionnées.", "",
        "| modèle | direction | retriever | représentation | K | seuil E | exact | covered Top-1 | notCovered exact | ambiguous exact | FP dangereux | V0 |",
        "|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|",
    ])
    for model_key in NLI_MODELS:
        for direction in DIRECTIONS:
            item = selected_for_direction(combinations, model_key, direction)
            metric = item["calibration"]["selected"]
            lines.append(
                f"| `{model_key}` | `{direction}` | `{item['retrieverKey']}` | `{item['representation']}` | {item['topK']} | "
                f"{metric['entailmentThreshold']:.7f} | {pct(metric['exactAccuracy'], 200)} | "
                f"{pct(metric['coveredTop1Correct'], 100)} | {pct(metric['byLabel']['notCovered']['exactCorrect'], 80)} | "
                f"{pct(metric['byLabel']['ambiguous']['exactCorrect'], 20)} | {metric['falsePositiveSeverity']['dangerous']} | "
                f"{'oui' if metric['meetsV0'] else 'non'} |"
            )
    lines.extend([
        "", "## Ablation représentation / Top-K sur development", "",
        "Chaque ligne retient la meilleure direction et le meilleur retriever sûrs pour le couple représentation/K; elle ne modifie pas la sélection globale.", "",
        "| modèle | représentation | K | direction | retriever | exact | covered Top-1 | retrieval misses | FP dangereux |",
        "|---|---|---:|---|---|---:|---:|---:|---:|",
    ])
    for model_key in NLI_MODELS:
        for representation in REPRESENTATIONS:
            for top_k in (3, 5):
                candidates = [
                    item for item in combinations
                    if item["modelKey"] == model_key and item["representation"] == representation and item["topK"] == top_k
                ]
                item = max(candidates, key=lambda candidate: objective(candidate["calibration"]["selected"]))
                metric = item["calibration"]["selected"]
                lines.append(
                    f"| `{model_key}` | `{representation}` | {top_k} | `{item['direction']}` | `{item['retrieverKey']}` | "
                    f"{pct(metric['exactAccuracy'], 200)} | {pct(metric['coveredTop1Correct'], 100)} | "
                    f"{metric['retrievalMisses']} | {metric['falsePositiveSeverity']['dangerous']} |"
                )
    lines.extend(["", "## Configurations verrouillées avant holdout", ""])
    for model_key in NLI_MODELS:
        selection = selections[model_key]
        metric = next(
            item["calibration"]["selected"] for item in combinations
            if all(item[key] == selection[key] for key in ("modelKey", "retrieverKey", "representation", "topK", "direction"))
        )
        lines.extend([
            f"### {model_key}", "",
            f"- `{selection['retrieverKey']}` / `{selection['representation']}` / Top-{selection['topK']} / `{selection['direction']}`.",
            f"- Seuil entailment : `{selection['entailmentThreshold']}`; {pct(metric['coveredTop1Correct'], 100)} covered corrects; "
            f"{metric['falsePositiveSeverity']['dangerous']} faux positif dangereux; V0 development : {'oui' if metric['meetsV0'] else 'non'}.",
            "",
        ])
    lines.extend([
        "", "## Holdout final — passage unique", "",
        "| modèle | exact global | covered Top-1 | notCovered exact | ambiguous exact | ambiguous sans match | FP f/m/d | sur-abst. | retrieval misses | erreurs NLI candidat présent | V0 |",
        "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|",
    ])
    for model_key in NLI_MODELS:
        metric = holdouts[model_key]["metrics"]
        sev = metric["falsePositiveSeverity"]
        lines.append(
            f"| `{model_key}` | {pct(metric['exactAccuracy'], 96)} | {pct(metric['coveredTop1Correct'], 32)} | "
            f"{pct(metric['byLabel']['notCovered']['exactCorrect'], 32)} | {pct(metric['byLabel']['ambiguous']['exactCorrect'], 32)} | "
            f"{pct(metric['ambiguousSafelyRejected'], 32)} | {sev['weak']}/{sev['medium']}/{sev['dangerous']} | "
            f"{metric['overAbstentions']} | {metric['retrievalMisses']} | {metric['nliErrorsWhenExpectedRetrieved']} | "
            f"{'oui' if metric['meetsV0'] else 'non'} |"
        )
    lines.extend([
        "", "### Holdout par type — correct exact", "",
        "| type | cas | MiniLM NLI | mDeBERTa NLI |",
        "|---|---:|---:|---:|",
    ])
    first_types = holdouts[NLI_MODELS[0]]["metrics"]["byType"]
    for type_name, group in first_types.items():
        other = holdouts[NLI_MODELS[1]]["metrics"]["byType"][type_name]
        lines.append(f"| `{type_name}` | {group['cases']} | {group['exactCorrect']} | {other['exactCorrect']} |")
    lines.extend([
        "", "### Catégories covered — Top-1 correct", "",
        "| catégorie | cas | MiniLM NLI | mDeBERTa NLI |",
        "|---|---:|---:|---:|",
    ])
    for type_name in ("paraphrase_naturelle", "synonymes", "vocabulaire_different", "adjacentButResolvable"):
        first = holdouts[NLI_MODELS[0]]["metrics"]["byType"][type_name]
        second = holdouts[NLI_MODELS[1]]["metrics"]["byType"][type_name]
        lines.append(f"| `{type_name}` | {first['cases']} | {first['coveredCorrect']} | {second['coveredCorrect']} |")
    lines.extend([
        "", "## Performance CPU", "",
        "Latence Top-3/Top-5 : mêmes 36 cas development (12 par label), configuration verrouillée, modèle déjà chargé.", "",
        "| modèle | K | total mean / p50 / p95 | NLI mean / p50 / p95 |",
        "|---|---:|---:|---:|",
    ])
    for model_key in NLI_MODELS:
        for top_k in (3, 5):
            item = latency[model_key][f"top{top_k}"]
            total = item["totalWarmMilliseconds"]
            nli = item["nliWarmMilliseconds"]
            lines.append(
                f"| `{model_key}` | {top_k} | {total['mean']:.1f} / {total['p50']:.1f} / {total['p95']:.1f} ms | "
                f"{nli['mean']:.1f} / {nli['p50']:.1f} / {nli['p95']:.1f} ms |"
            )
    lines.extend(["", "| modèle | premier chargement NLI | cold start processus combiné | vectorisation 112 | RAM chargée | pic RAM |", "|---|---:|---:|---:|---:|---:|"])
    for model_key in NLI_MODELS:
        perf = holdouts[model_key]["performance"]
        initial_load = nli_outputs[model_key]["performance"]["modelLoadMilliseconds"]
        lines.append(
            f"| `{model_key}` | {initial_load:.1f} ms | {perf['combinedColdStartMilliseconds']:.1f} ms | "
            f"{perf['canonical112VectorizationMilliseconds']:.1f} ms | {perf['rssBothLoadedMiB']:.2f} MiB | {perf['rssPeakMiB']:.2f} MiB |"
        )
    hardware = holdouts[NLI_MODELS[0]]["hardware"]
    lines.extend([
        "", f"Matériel : {hardware['processor']}; {hardware['physicalCores']} cœurs physiques / {hardware['logicalCores']} logiques; {hardware['cpuThreadsUsed']} threads utilisés.",
        "Le `premier chargement NLI` est le premier chargement du worker development. Le `cold start processus combiné` est un nouveau processus retriever+NLI lancé après calibration, avec fichiers potentiellement présents dans le cache disque de l’OS. Les durées globales du scoring development ne sont pas publiées, car la machine a été suspendue pendant ce run et leur temps mural serait trompeur; les latences chaudes ci-dessus ont été mesurées sur une fenêtre active dédiée.",
    ])
    for model_key in NLI_MODELS:
        metric = holdouts[model_key]["metrics"]
        lines.extend([
            "", f"## Exemples — {model_key}", "", "### Faux positifs dangereux", "",
            *examples(metric, lambda item: item["case"]["label"] != "covered" and item["predictedLabel"] == "covered" and item["case"].get("risk") == "dangerous"),
            "", "### Sur-abstentions covered", "",
            *examples(metric, lambda item: item["case"]["label"] == "covered" and item["predictedLabel"] != "covered"),
            "", "### Erreurs NLI avec bon candidat récupéré", "",
            *examples(metric, lambda item: item["case"]["label"] == "covered" and item["expectedInK"] and not item["exactCorrect"]),
            "", "### Ambiguïtés correctement identifiées", "",
            *examples(metric, lambda item: item["case"]["label"] == "ambiguous" and item["predictedLabel"] == "ambiguous", 3),
        ])
    passing = [key for key in NLI_MODELS if holdouts[key]["metrics"]["meetsV0"]]
    lines.extend(["", "## Verdict", ""])
    if not passing:
        lines.append("Aucune des deux architectures NLI ne satisfait les critères Liquid Core V0 sur le nouveau holdout. Aucune architecture n’est recommandée et aucun choix produit n’est forcé.")
    elif len(passing) == 1:
        lines.append(f"Seule la configuration `{passing[0]}` satisfait les critères V0 mesurés sur le holdout; elle est recommandable pour une étape d’architecture ultérieure, sans constituer un branchement produit.")
    else:
        winner = max(passing, key=lambda key: (holdouts[key]["metrics"]["coveredTop1Correct"], holdouts[key]["metrics"]["exactAccuracy"]))
        lines.append(f"Les deux configurations passent le holdout; `{winner}` obtient le meilleur résultat de décision mesuré. Ce résultat reste expérimental et n’est pas un choix produit.")
    lines.extend([
        "", "L’approche QA extractive SQuAD2 n’a pas été exécutée. Elle reste une troisième voie distincte à décider séparément à partir de ce résultat NLI.",
        "", "## Limites", "",
        "- Le seuil unique d’entailment est une règle expérimentale, pas un Confidence Gate produit.",
        "- Les modèles NLI ont été entraînés pour l’inférence textuelle générale, pas spécifiquement pour la couverture d’une base de connaissances projet.",
        "- Les identifiants `equinoxe-qNNN` sont des fixtures synthétiques stables test-only, jamais des UUID ni des `entryId` PostgreSQL.",
        "- Aucun modèle, cache, chemin local, index, `SemanticProvider` ou fichier produit n’est inclus.", "",
    ])
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--retriever", action="append", type=parse_mapping, default=[])
    parser.add_argument("--nli", action="append", type=parse_mapping, default=[])
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--raw-output", type=Path)
    parser.add_argument("--from-raw", type=Path)
    parser.add_argument("--node", default=shutil.which("node") or "node")
    parser.add_argument("--cpu-threads", type=int, default=max(1, (os.cpu_count() or 2) // 2))
    args = parser.parse_args()
    if args.from_raw:
        raw = json.loads(args.from_raw.read_text(encoding="utf-8"))
        args.output.write_text(render_report(raw), encoding="utf-8")
        return 0
    retriever_paths, nli_paths = dict(args.retriever), dict(args.nli)
    if set(retriever_paths) != set(RETRIEVERS) or set(nli_paths) != set(NLI_MODELS):
        raise ValueError("Exactly two retained retrievers and two NLI candidates are required")
    for key, path in nli_paths.items():
        validate_artifact(key, path.resolve())
    seal = json.loads((HERE / "holdout-seal.json").read_text(encoding="utf-8"))
    with tempfile.TemporaryDirectory(prefix="storm-answerability-nli-") as temporary:
        root = Path(temporary)
        development_path = root / "development.json"
        development = export_payload(args.node, "development", development_path)
        retrievals, retrieval_files = {}, []
        for key in RETRIEVERS:
            output = root / f"retrieval-{key}.json"
            run([sys.executable, str(HERE / "retrieval_worker.py"), "--model-key", key, "--model-path", str(retriever_paths[key].resolve()), "--input", str(development_path), "--output", str(output), "--cpu-threads", str(args.cpu_threads)])
            retrieval_files.append(output)
            retrievals[key] = json.loads(output.read_text(encoding="utf-8"))
        nli_outputs = {}
        for key in NLI_MODELS:
            output = root / f"nli-{key}.json"
            command = [sys.executable, str(HERE / "nli_worker.py"), "--model-key", key, "--model-path", str(nli_paths[key].resolve()), "--input", str(development_path), "--output", str(output), "--cpu-threads", str(args.cpu_threads)]
            for path in retrieval_files:
                command.extend(["--retrieval", str(path)])
            run(command)
            nli_outputs[key] = json.loads(output.read_text(encoding="utf-8"))
        combinations = []
        for model_key in NLI_MODELS:
            for retriever_key in RETRIEVERS:
                for representation in REPRESENTATIONS:
                    for top_k in (3, 5):
                        for direction in DIRECTIONS:
                            source = nli_outputs[model_key]["scores"][retriever_key][representation][direction]
                            combinations.append({
                                "modelKey": model_key, "retrieverKey": retriever_key,
                                "representation": representation, "topK": top_k, "direction": direction,
                                "calibration": calibrate(source, top_k),
                            })
        selections = {}
        for model_key in NLI_MODELS:
            selected = max(
                [item for item in combinations if item["modelKey"] == model_key],
                key=lambda item: objective(item["calibration"]["selected"]),
            )
            metrics = selected["calibration"]["selected"]
            selections[model_key] = {
                "modelKey": model_key, "retrieverKey": selected["retrieverKey"],
                "representation": selected["representation"], "topK": selected["topK"],
                "direction": selected["direction"], "entailmentThreshold": metrics["entailmentThreshold"],
                "priorDecisionFingerprint": development["priorDecisionFingerprint"],
                "answerabilityHoldoutFingerprint": seal["answerabilityHoldoutFingerprint"],
            }
        selection_paths, latency = {}, {}
        for model_key, selection in selections.items():
            selection_path = root / f"selection-{model_key}.json"
            selection_path.write_text(json.dumps(selection), encoding="utf-8")
            selection_paths[model_key] = selection_path
            latency_path = root / f"latency-{model_key}.json"
            run([sys.executable, str(HERE / "latency_worker.py"), "--selection", str(selection_path), "--input", str(development_path), "--retriever-path", str(retriever_paths[selection['retrieverKey']].resolve()), "--nli-path", str(nli_paths[model_key].resolve()), "--output", str(latency_path), "--cpu-threads", str(args.cpu_threads)])
            latency[model_key] = json.loads(latency_path.read_text(encoding="utf-8"))
        holdout_path = root / "sealed-holdout.json"
        holdout_payload = export_payload(args.node, "holdout", holdout_path)
        if holdout_payload["answerabilityHoldoutFingerprint"] != seal["answerabilityHoldoutFingerprint"]:
            raise ValueError("Exported holdout does not match pre-inference seal")
        holdouts = {}
        for model_key, selection in selections.items():
            output = root / f"holdout-{model_key}.json"
            run([sys.executable, str(HERE / "final_holdout_worker.py"), "--selection", str(selection_paths[model_key]), "--input", str(holdout_path), "--retriever-path", str(retriever_paths[selection['retrieverKey']].resolve()), "--nli-path", str(nli_paths[model_key].resolve()), "--output", str(output), "--cpu-threads", str(args.cpu_threads)])
            holdouts[model_key] = json.loads(output.read_text(encoding="utf-8"))
        raw = {
            "development": {key: development[key] for key in ("corpusFingerprint", "priorDecisionFingerprint")},
            "answerabilityHoldoutFingerprint": seal["answerabilityHoldoutFingerprint"],
            "retrievals": retrievals, "nliOutputs": nli_outputs, "combinations": combinations,
            "lockedSelections": selections, "latency": latency, "holdouts": holdouts,
        }
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(render_report(raw), encoding="utf-8")
        if args.raw_output:
            args.raw_output.parent.mkdir(parents=True, exist_ok=True)
            args.raw_output.write_text(json.dumps(raw, ensure_ascii=False), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
