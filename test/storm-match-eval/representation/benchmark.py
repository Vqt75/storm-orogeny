"""Run and report the knowledge-representation retrieval experiment."""

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

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[2]
MODELS = ("e5-small", "distiluse-cased-v2")
REPRESENTATIONS = ("question", "answer", "questionAnswer", "multi")
LABELS = {
    "question": "Question", "answer": "Réponse", "questionAnswer": "Question + réponse",
    "multi": "Multi-représentation (max Q/A/Q+A)",
}


def parse_mapping(value: str) -> tuple[str, Path]:
    key, separator, raw_path = value.partition("=")
    if not separator or key not in MODELS or not raw_path:
        raise argparse.ArgumentTypeError("Expected e5-small=/absolute/path or distiluse-cased-v2=/absolute/path")
    return key, Path(raw_path)


def offline_environment() -> dict[str, str]:
    environment = os.environ.copy()
    environment.update({
        "HF_HUB_OFFLINE": "1", "TRANSFORMERS_OFFLINE": "1", "HF_DATASETS_OFFLINE": "1",
        "HF_HUB_DISABLE_TELEMETRY": "1", "TOKENIZERS_PARALLELISM": "false", "PYTHONDONTWRITEBYTECODE": "1",
    })
    return environment


def pct(metric: dict[str, Any], rank: int) -> str:
    value = metric[f"recallAt{rank}"]
    return f"{value}/{metric['cases']} ({100 * value / metric['cases']:.1f}%)"


def render_report(payload: dict[str, Any], results: dict[str, Any]) -> str:
    lines = [
        "# Storm Match — knowledge representation retrieval", "",
        f"- Corpus officiel : `{payload['corpusFingerprint']}` — 290 cas résolubles.",
        f"- Decision Corpus : `{payload['decisionFingerprint']}` — 100 positifs, sans négatifs ni décision d’abstention.",
        "- Sous-ensemble diagnostique : les 16 `retrievalMisses` Top-3 du holdout verifier précédent.",
        "- Retrieval sémantique pur : aucun verifier, score lexical, seuil ou gate.",
        "- Modèles : snapshots locaux épinglés E5-small et DistilUSE; CPU; Transformers/Hugging Face offline.",
        "", "## Représentations", "",
        "- `question` : un vecteur par question canonique.",
        "- `answer` : un vecteur par réponse canonique.",
        "- `questionAnswer` : un vecteur par concaténation libellée de la question et de la réponse.",
        "- `multi` : trois vecteurs par entrée (Q, A, Q+A); score d’entrée = maximum des trois similarités, puis déduplication par `entryId`.",
        "", "## Corpus officiel", "",
        "| modèle | représentation | Recall@1 | Recall@3 | Recall@5 |",
        "|---|---|---:|---:|---:|",
    ]
    for model_key in MODELS:
        for representation in REPRESENTATIONS:
            metric = results[model_key]["representations"][representation]["official"]
            lines.append(f"| `{model_key}` | {LABELS[representation]} | {pct(metric, 1)} | {pct(metric, 3)} | {pct(metric, 5)} |")
    lines.extend(["", "### Catégories officielles — Recall@1 / @3 / @5", ""])
    categories = list(results[MODELS[0]]["representations"]["question"]["official"]["byGroup"])
    lines.append("| catégorie | " + " | ".join(f"{model}/{rep}" for model in MODELS for rep in REPRESENTATIONS) + " |")
    lines.append("|---|" + "---:|" * (len(MODELS) * len(REPRESENTATIONS)))
    for category in categories:
        cells = []
        for model_key in MODELS:
            for representation in REPRESENTATIONS:
                metric = results[model_key]["representations"][representation]["official"]["byGroup"][category]
                cells.append(f"{metric['recallAt1']}/{metric['recallAt3']}/{metric['recallAt5']} ({metric['cases']})")
        lines.append(f"| `{category}` | " + " | ".join(cells) + " |")
    lines.extend([
        "", "## Decision Corpus — 100 positifs", "",
        "| modèle | représentation | Recall@1 | Recall@3 | Recall@5 |",
        "|---|---|---:|---:|---:|",
    ])
    for model_key in MODELS:
        for representation in REPRESENTATIONS:
            metric = results[model_key]["representations"][representation]["decisionPositive"]
            lines.append(f"| `{model_key}` | {LABELS[representation]} | {pct(metric, 1)} | {pct(metric, 3)} | {pct(metric, 5)} |")
    lines.extend([
        "", "### Catégories décisionnelles — Recall@1 / @3 / @5", "",
        "| catégorie | " + " | ".join(f"{model}/{rep}" for model in MODELS for rep in REPRESENTATIONS) + " |",
        "|---|" + "---:|" * (len(MODELS) * len(REPRESENTATIONS)),
    ])
    decision_categories = ("paraphrase_naturelle", "synonymes", "vocabulaire_different", "adjacentButResolvable")
    for category in decision_categories:
        cells = []
        for model_key in MODELS:
            for representation in REPRESENTATIONS:
                metric = results[model_key]["representations"][representation]["decisionPositive"]["byGroup"][category]
                cells.append(f"{metric['recallAt1']}/{metric['recallAt3']}/{metric['recallAt5']} ({metric['cases']})")
        lines.append(f"| `{category}` | " + " | ".join(cells) + " |")
    lines.extend([
        "", "## Les 16 misses du holdout précédent", "",
        "| modèle | représentation | Recall@1 | Recall@3 | Recall@5 |",
        "|---|---|---:|---:|---:|",
    ])
    for model_key in MODELS:
        for representation in REPRESENTATIONS:
            metric = results[model_key]["representations"][representation]["priorHoldoutMisses"]
            lines.append(f"| `{model_key}` | {LABELS[representation]} | {pct(metric, 1)} | {pct(metric, 3)} | {pct(metric, 5)} |")
    lines.extend(["", "### Misses récupérés par la multi-représentation", ""])
    for model_key in MODELS:
        question = results[model_key]["representations"]["question"]["priorHoldoutMissResults"]
        multi = results[model_key]["representations"]["multi"]["priorHoldoutMissResults"]
        recovered = []
        for baseline, candidate in zip(question, multi):
            expected = candidate["case"]["expectedEntryId"]
            if expected not in baseline["topEntryIds"][:3] and expected in candidate["topEntryIds"][:3]:
                rank = candidate["topEntryIds"].index(expected) + 1
                recovered.append((candidate, rank))
        lines.extend(["", f"#### {model_key}", ""])
        if not recovered:
            lines.append("- Aucun miss récupéré dans le Top-3.")
        else:
            for item, rank in recovered:
                case = item["case"]
                lines.append(f"- `{case['id']}` — attendu `{case['expectedEntryId']}`, rang multi {rank} — {case['formulation']}")
    lines.extend(["", "## Coût de vectorisation", "", "| modèle | chargement | 390 requêtes | 112 Q | 112 A | 112 Q+A | RAM chargée |", "|---|---:|---:|---:|---:|---:|---:|"])
    for model_key in MODELS:
        perf = results[model_key]["performance"]
        vec = perf["canonical112VectorizationMilliseconds"]
        lines.append(
            f"| `{model_key}` | {perf['modelLoadMilliseconds']:.1f} ms | {perf['all390QueriesMilliseconds']:.1f} ms | "
            f"{vec['question']:.1f} ms | {vec['answer']:.1f} ms | {vec['questionAnswer']:.1f} ms | {perf['rssLoadedMiB']:.2f} MiB |"
        )
    lines.extend(["", "## Conclusions de l’expérience A", ""])
    e5_q = results["e5-small"]["representations"]["question"]["decisionPositive"]
    e5_m = results["e5-small"]["representations"]["multi"]["decisionPositive"]
    dist_q = results["distiluse-cased-v2"]["representations"]["question"]["decisionPositive"]
    dist_m = results["distiluse-cased-v2"]["representations"]["multi"]["decisionPositive"]
    lines.extend([
        f"- E5 Decision positif : question {pct(e5_q, 3)} à R@3; multi {pct(e5_m, 3)}.",
        f"- DistilUSE Decision positif : question {pct(dist_q, 3)} à R@3; multi {pct(dist_m, 3)}.",
        "- La concaténation Q+A est la meilleure représentation sur les 100 positifs : E5 80/100 et DistilUSE 82/100 à R@3. Elle récupère 10/16 anciens misses pour chacun des deux modèles.",
        "- Le `max(Q,A,Q+A)` naïf améliore légèrement le corpus officiel à R@3/R@5, mais reste inférieur à Q+A sur les positifs décisionnels et sur les 16 misses. Multiplier les représentations sans calibrer leur fusion crée donc aussi du bruit.",
        "- La réponse seule est insuffisante comme index principal. Son gain ponctuel confirme néanmoins que la réponse publiée contient un signal absent de certaines questions canoniques.",
        "- Le meilleur choix de représentation doit être lu comme un résultat de retrieval seulement : cette expérience ne mesure aucune capacité d’abstention.",
        "- Les résultats ne modifient ni le corpus officiel, ni la baseline, ni le code produit.", "",
    ])
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", action="append", type=parse_mapping, default=[])
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--raw-output", type=Path)
    parser.add_argument("--from-raw", type=Path)
    parser.add_argument("--node", default=shutil.which("node") or "node")
    parser.add_argument("--cpu-threads", type=int, default=max(1, (os.cpu_count() or 2) // 2))
    args = parser.parse_args()
    if args.from_raw:
        raw = json.loads(args.from_raw.read_text(encoding="utf-8"))
        args.output.write_text(render_report(raw["payload"], raw["results"]), encoding="utf-8")
        return 0
    paths = dict(args.model)
    if set(paths) != set(MODELS) or any(not path.is_absolute() or not path.is_dir() for path in paths.values()):
        raise ValueError("Both retrievers must be configured as existing absolute local paths")
    with tempfile.TemporaryDirectory(prefix="storm-knowledge-retrieval-") as temporary:
        root = Path(temporary)
        completed = subprocess.run([args.node, str(HERE / "export-input.mjs")], cwd=REPO_ROOT, capture_output=True, text=True, encoding="utf-8", check=True)
        payload = json.loads(completed.stdout)
        input_path = root / "input.json"
        input_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        results = {}
        for model_key in MODELS:
            output = root / f"{model_key}.json"
            command = [sys.executable, str(HERE / "worker.py"), "--model-key", model_key, "--model-path", str(paths[model_key]), "--input", str(input_path), "--output", str(output), "--cpu-threads", str(args.cpu_threads)]
            subprocess.run(command, cwd=REPO_ROOT, env=offline_environment(), check=True)
            results[model_key] = json.loads(output.read_text(encoding="utf-8"))
        report = render_report(payload, results)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(report, encoding="utf-8")
        if args.raw_output:
            args.raw_output.parent.mkdir(parents=True, exist_ok=True)
            args.raw_output.write_text(json.dumps({"payload": payload, "results": results}, ensure_ascii=False), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
