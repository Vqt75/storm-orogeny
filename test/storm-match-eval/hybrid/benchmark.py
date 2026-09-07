"""Orchestrate the offline Storm Match hybrid benchmark for E5 and DistilUSE."""

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
SEMANTIC_DIR = HERE.parent / "semantic"
sys.path.insert(0, str(SEMANTIC_DIR))

from adapters import MODEL_SPECS, validate_local_artifact  # noqa: E402
from calibration import grid_contract  # noqa: E402

MODEL_ORDER = ("e5-small", "distiluse-cased-v2")
CATEGORY_ORDER = (
    "quasi_identique",
    "paraphrase_naturelle",
    "conversationnel",
    "formulation_courte",
    "synonymes",
    "vocabulaire_different",
    "syntaxe_imparfaite",
    "faute_de_frappe",
    "mots_cles_seuls",
    "ambiguite_adjacent",
)


def parse_model_argument(value: str) -> tuple[str, Path]:
    if "=" not in value:
        raise argparse.ArgumentTypeError("Expected KEY=ABSOLUTE_PATH")
    key, raw_path = value.split("=", 1)
    if key not in MODEL_ORDER:
        raise argparse.ArgumentTypeError(f"Hybrid model must be one of {MODEL_ORDER}")
    path = Path(raw_path)
    if not path.is_absolute():
        raise argparse.ArgumentTypeError("Hybrid model path must be absolute")
    return key, path


def export_input(node: str, destination: Path) -> dict[str, Any]:
    completed = subprocess.run(
        [node, str(HERE / "export-input.mjs")],
        cwd=REPO_ROOT,
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    payload = json.loads(completed.stdout)
    destination.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    return payload


def validate_payload(payload: dict[str, Any]) -> None:
    if len(payload.get("entries", [])) != 112 or len(payload.get("cases", [])) != 320:
        raise ValueError("Hybrid benchmark requires the official 112-entry / 320-case corpus")
    if sum(case.get("expectedEntryId") is not None for case in payload["cases"]) != 290:
        raise ValueError("Hybrid benchmark requires 290 resolvable cases")
    if sum(case.get("ambiguityClassification") == "trueAmbiguous" for case in payload["cases"]) != 10:
        raise ValueError("Hybrid benchmark requires 10 true-ambiguous cases")
    if sum(case["category"] == "hors_corpus" for case in payload["cases"]) != 20:
        raise ValueError("Hybrid benchmark requires 20 out-of-corpus cases")
    for case in payload["cases"]:
        scores = [candidate["normalizedScore"] for candidate in case["lexicalCandidates"]]
        if len(scores) != 112 or not all(0 <= score <= 1 for score in scores):
            raise ValueError(f"{case['id']}: invalid normalized lexical scores")


def heuristic_metrics(payload: dict[str, Any]) -> dict[str, Any]:
    cases = payload["cases"]
    resolvable = [case for case in cases if case.get("expectedEntryId") is not None]
    out_of_corpus = [case for case in cases if case["category"] == "hors_corpus"]
    true_ambiguous = [
        case for case in cases if case.get("ambiguityClassification") == "trueAmbiguous"
    ]
    by_category = {}
    for category in CATEGORY_ORDER:
        positives = [
            case
            for case in cases
            if case["category"] == category and case.get("expectedEntryId") is not None
        ]
        by_category[category] = {
            "cases": len(positives),
            "top1": sum(case["heuristic"]["top1Correct"] for case in positives),
            "top3": sum(case["heuristic"]["top3Correct"] for case in positives),
        }
    false_positives = [
        case for case in out_of_corpus if case["heuristic"]["outcome"] != "abstained"
    ]
    severity = {"weak": 0, "medium": 0, "dangerous": 0}
    for case in false_positives:
        score = case["heuristic"]["topCandidateRawScore"]
        bucket = "dangerous" if score >= 28 else ("medium" if score >= 18 else "weak")
        severity[bucket] += 1
    return {
        "top1Resolvable": sum(case["heuristic"]["top1Correct"] for case in resolvable),
        "top3Resolvable": sum(case["heuristic"]["top3Correct"] for case in resolvable),
        "byCategory": by_category,
        "trueAmbiguousAbstentions": sum(
            case["heuristic"]["outcome"] == "abstained" for case in true_ambiguous
        ),
        "outOfCorpusAbstentions": sum(
            case["heuristic"]["outcome"] == "abstained" for case in out_of_corpus
        ),
        "outOfCorpusFalsePositives": len(false_positives),
        "falsePositiveSeverity": severity,
        "overAbstentions": sum(
            case["heuristic"]["outcome"] == "abstained" for case in resolvable
        ),
    }


def run_worker(
    args: argparse.Namespace, key: str, model_path: Path, input_path: Path, output_path: Path
) -> dict[str, Any]:
    environment = os.environ.copy()
    environment.update(
        {
            "HF_HUB_OFFLINE": "1",
            "TRANSFORMERS_OFFLINE": "1",
            "HF_DATASETS_OFFLINE": "1",
            "HF_HUB_DISABLE_TELEMETRY": "1",
            "TOKENIZERS_PARALLELISM": "false",
            "PYTHONDONTWRITEBYTECODE": "1",
        }
    )
    completed = subprocess.run(
        [
            sys.executable,
            str(HERE / "worker.py"),
            "--model-key",
            key,
            "--model-path",
            str(model_path),
            "--input",
            str(input_path),
            "--output",
            str(output_path),
            "--device",
            "cpu",
            "--cpu-threads",
            str(args.cpu_threads),
            "--batch-size",
            str(args.batch_size),
        ],
        cwd=REPO_ROOT,
        env=environment,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    if completed.returncode != 0:
        return {
            "status": "FAILED",
            "model": {"key": key, "modelId": MODEL_SPECS[key]["modelId"]},
            "reason": (completed.stderr or completed.stdout or "worker failed").strip(),
        }
    return json.loads(output_path.read_text(encoding="utf-8"))


def pct(value: int, total: int) -> str:
    return f"{value}/{total} ({value * 100 / total:.1f}%)"


def method_cell(value: int | None, total: int) -> str:
    return "n/a" if value is None else pct(value, total)


def example_line(result: dict[str, Any]) -> str:
    case = result["case"]
    return (
        f"- `{case['id']}` — {case['formulation']} — expected `{case.get('expectedEntryId')}`, "
        f"outcome `{result['outcome']}`, actual `{result.get('matchedEntryId')}`, "
        f"top1 `{result['top1']['entryId']}` hybrid={result['top1']['combinedScore']:.4f} "
        f"semantic={result['top1']['semanticScore']:.4f} lexical={result['top1']['lexicalScore']:.4f}, "
        f"margin={result['marginTop1Top2']:.4f}, gate={result.get('gatePath')}."
    )


def render_report(results: dict[str, dict[str, Any]], payload: dict[str, Any]) -> str:
    heuristic = heuristic_metrics(payload)
    measured = [results[key] for key in MODEL_ORDER if results[key]["status"] == "MEASURED"]
    lines = [
        "# Storm Match — benchmark hybride V0",
        "",
        f"- Corpus officiel : `{payload['corpusFingerprint']}`",
        "- Questions canoniques : 112",
        "- Cas : 320, dont 290 résolubles, 10 `trueAmbiguous` et 20 hors corpus",
        "- Score sémantique : cosinus borné à `[0,1]` pour le mélange",
        "- Score lexical : vrai `scoreEntry()` normalisé par `clamp(score / 28, 0, 1)`",
        "- Soutien lexical moyen : `18/28 = 0.642857` (seuil existant, non calibré)",
        "- Modèles hybrides mesurés : " + f"{len(measured)}/2",
        "- Exécution : CPU, Hugging Face / Transformers offline",
        "",
        "## Règle du Confidence Gate testée",
        "",
        "Le classement porte sur `W_sem × semantic + W_lex × lexical`, avec `W_sem + W_lex = 1`. "
        "Le candidat Top-1 est accepté si son plancher sémantique et sa marge sont satisfaits, puis soit son score hybride atteint le seuil haut (lexical optionnel), soit il atteint le seuil moyen avec le soutien lexical existant. Dans tous les autres cas, le matcher s'abstient.",
        "",
        "Un faux positif est `dangerous` s'il passe la voie haute ou si son score lexical brut atteint 28 ; "
        "il est `medium` s'il passe la voie moyenne avec soutien lexical, sinon `weak`.",
        "",
        "## Espace de calibration systématique",
        "",
    ]
    grid = grid_contract()
    lines.extend(
        [
            f"- `W_sem` : 0.500 à 0.950 par pas de 0.050 ; `W_lex = 1 - W_sem` (les deux signaux restent non nuls)",
            f"- seuil haut : 0.500 à 0.950 par pas de 0.050",
            f"- seuil moyen : 0.300 à 0.850 par pas de 0.050, strictement inférieur au seuil haut",
            f"- marge : 0.005 à 0.150 par pas de 0.005",
            f"- plancher sémantique : absent, ou 0.300 à 0.850 par pas de 0.050",
            f"- configurations prévues par modèle : {grid['totalConfigurations']:,}".replace(",", " "),
            "",
            "Admissibilité : zéro acceptation dangereuse parmi les 30 cas à attendu nul et au plus 3 faux positifs hors corpus. Le filtre V0 ajoute Top-1 ≥ 218/290, paraphrase ≥ 23/30, `differentVocab` ≥ 15/30 et abstention sur 10/10 `trueAmbiguous`.",
            "",
            "## Meilleures configurations admissibles",
            "",
            "| paramètre | E5-small | DistilUSE |",
            "|---|---:|---:|",
        ]
    )
    for label, key in (
        ("W_sem", "weightSemantic"),
        ("W_lex", "weightLexical"),
        ("Seuil haut", "highMatchThreshold"),
        ("Seuil moyen", "mediumMatchThreshold"),
        ("Seuil marge", "marginThreshold"),
        ("Plancher sémantique", "minimumSemantic"),
    ):
        values = []
        for model_key in MODEL_ORDER:
            result = results[model_key]
            if result["status"] != "MEASURED":
                values.append("n/a")
            else:
                value = result["calibration"]["selected"]["configuration"][key]
                values.append("aucun" if value is None else f"{value:.3f}")
        lines.append(f"| {label} | {values[0]} | {values[1]} |")
    lines.extend(["", "## Comparaison heuristique / sémantique / hybride", ""])
    headers = ["Heuristique"]
    methods: list[tuple[str, dict[str, Any], str]] = []
    for model_key in MODEL_ORDER:
        result = results[model_key]
        label = "E5" if model_key == "e5-small" else "DistilUSE"
        headers.extend([f"{label} sémantique", f"{label} hybride"])
        if result["status"] == "MEASURED":
            methods.extend(
                [
                    (f"{label} sémantique", result["semanticOnly"], "semantic"),
                    (f"{label} hybride", result["calibration"]["selected"], "hybrid"),
                ]
            )
    lines.append("| métrique | " + " | ".join(headers) + " |")
    lines.append("|---|" + "---:|" * len(headers))

    def cells(metric: str, total: int) -> list[str]:
        values = [method_cell(heuristic.get(metric), total)]
        for _, data, _ in methods:
            values.append(method_cell(data.get(metric), total))
        return values

    for label, metric, total in (
        ("Top-1 résoluble", "top1Resolvable", 290),
        ("Top-3 diagnostic", "top3Resolvable", 290),
        ("TrueAmbiguous abstentions", "trueAmbiguousAbstentions", 10),
        ("Hors corpus abstentions", "outOfCorpusAbstentions", 20),
        ("Hors corpus faux positifs", "outOfCorpusFalsePositives", 20),
    ):
        values = cells(metric, total)
        lines.append(f"| {label} | " + " | ".join(values) + " |")

    values = [str(heuristic["overAbstentions"])]
    for _, data, method_type in methods:
        values.append("0 (pas de gate)" if method_type == "semantic" else str(data["overAbstentions"]))
    lines.append("| Sur-abstentions | " + " | ".join(values) + " |")

    lines.extend(["", "## Résultats Top-1 / Top-3 par catégorie", ""])
    lines.append("| catégorie | Heuristique | E5 sémantique | E5 hybride | DistilUSE sémantique | DistilUSE hybride |")
    lines.append("|---|---:|---:|---:|---:|---:|")
    for category in CATEGORY_ORDER:
        h = heuristic["byCategory"][category]
        row = [f"{h['top1']}/{h['cases']} · {h['top3']}/{h['cases']}"]
        for _, data, method_type in methods:
            item = data["byCategory"].get(category, {})
            if method_type == "semantic":
                row.append(f"{item.get('top1', 0)}/{item.get('cases', 0)} · {item.get('top3', 0)}/{item.get('cases', 0)}")
            else:
                row.append(f"{item.get('correct', 0)}/{item.get('positives', 0)} · {item.get('top3', 0)}/{item.get('positives', 0)}")
        lines.append(f"| `{category}` | " + " | ".join(row) + " |")

    lines.extend(["", "## Calibration et erreurs", ""])
    lines.append("| mesure | E5 hybride | DistilUSE hybride |")
    lines.append("|---|---:|---:|")
    for label, key in (
        ("Configurations évaluées", "evaluatedConfigurations"),
        ("Configurations admissibles", "admissibleConfigurations"),
        ("Configurations satisfaisant tous les critères V0", "v0Configurations"),
    ):
        values = [
            str(results[model_key]["calibration"][key])
            if results[model_key]["status"] == "MEASURED"
            else "n/a"
            for model_key in MODEL_ORDER
        ]
        lines.append(f"| {label} | {values[0]} | {values[1]} |")
    for label, key in (
        ("Échecs heuristiques corrigés", "heuristicFailuresCorrected"),
        ("Nouvelles erreurs vs heuristique", "newErrorsVersusHeuristic"),
        ("Matches résolubles erronés", "wrongResolvableMatches"),
        ("Faux positifs faibles", "weak"),
        ("Faux positifs moyens", "medium"),
        ("Faux positifs dangereux", "dangerous"),
    ):
        values = []
        for model_key in MODEL_ORDER:
            selected = results[model_key]["calibration"]["selected"]
            value = selected["falsePositiveSeverity"][key] if key in {"weak", "medium", "dangerous"} else selected[key]
            values.append(str(value))
        lines.append(f"| {label} | {values[0]} | {values[1]} |")

    for model_key in MODEL_ORDER:
        result = results[model_key]
        if result["status"] != "MEASURED":
            continue
        label = result["model"]["modelId"]
        selected = result["calibration"]["selected"]
        lines.extend(
            [
                "",
                f"## Exemples — {label}",
                "",
                f"Configuration conforme à tous les critères V0 : **{'oui' if selected['meetsV0'] else 'non'}**.",
                "",
            ]
        )
        for title, key in (
            ("Échecs heuristiques corrigés", "heuristicFailuresCorrected"),
            ("Nouvelles erreurs introduites", "newErrorsVersusHeuristic"),
            ("Sur-abstentions représentatives", "overAbstentions"),
            ("Faux positifs hors corpus", "outOfCorpusFalsePositives"),
            ("Cas trueAmbiguous", "trueAmbiguous"),
        ):
            lines.extend([f"### {title}", ""])
            examples = result["calibration"]["examples"][key]
            if not examples:
                lines.append("- Aucun.")
            else:
                lines.extend(example_line(example) for example in examples[:8])
            lines.append("")

    lines.extend(["## Verdict V0", ""])
    passing = [
        result for result in measured if result["calibration"]["selected"]["meetsV0"]
    ]
    if not passing:
        lines.append("Aucune configuration ne satisfait simultanément tous les critères V0. Aucun choix n'est forcé.")
    elif len(passing) == 1:
        lines.append(
            f"Seul `{passing[0]['model']['modelId']}` possède une configuration satisfaisant tous les critères V0 dans la grille mesurée."
        )
    else:
        lines.append("Les deux modèles possèdent au moins une configuration satisfaisant tous les critères V0 ; les métriques ci-dessus permettent de les départager.")
    lines.extend(
        [
            "",
            "## Limites",
            "",
            "- Calibration et mesure utilisent le même corpus officiel : ces résultats mesurent l'aptitude sur la baseline, pas la généralisation hors échantillon.",
            "- La gravité est une taxonomie benchmark explicite, pas encore une politique produit.",
            "- Aucun `SemanticProvider`, index, branchement Ivory ou modification du moteur produit n'est inclus.",
            "",
        ]
    )
    return "\n".join(lines)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", action="append", type=parse_model_argument, default=[])
    parser.add_argument("--output", type=Path)
    parser.add_argument("--raw-output", type=Path)
    parser.add_argument("--node", default=shutil.which("node") or "node")
    parser.add_argument("--cpu-threads", type=int, default=max(1, (os.cpu_count() or 2) // 2))
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--validate-only", action="store_true")
    parser.add_argument("--require-all", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    model_paths = dict(args.model)
    with tempfile.TemporaryDirectory(prefix="storm-hybrid-benchmark-") as temporary:
        temporary_path = Path(temporary)
        input_path = temporary_path / "input.json"
        payload = export_input(args.node, input_path)
        validate_payload(payload)
        if args.validate_only:
            artifacts = {
                key: validate_local_artifact(key, path.resolve())
                for key, path in model_paths.items()
            }
            print(
                json.dumps(
                    {
                        "valid": True,
                        "corpusFingerprint": payload["corpusFingerprint"],
                        "entries": len(payload["entries"]),
                        "cases": len(payload["cases"]),
                        "grid": grid_contract(),
                        "configuredArtifacts": list(artifacts),
                    },
                    indent=2,
                )
            )
            return 0

        results = {}
        for key in MODEL_ORDER:
            path = model_paths.get(key)
            if path is None or not path.is_dir():
                results[key] = {
                    "status": "NOT_RUN",
                    "model": {"key": key, "modelId": MODEL_SPECS[key]["modelId"]},
                    "reason": "absolute local model path not configured or missing",
                }
            else:
                results[key] = run_worker(
                    args, key, path.resolve(), input_path, temporary_path / f"{key}.json"
                )
        report = render_report(results, payload)
        if args.output:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(report, encoding="utf-8")
        else:
            print(report)
        if args.raw_output:
            args.raw_output.parent.mkdir(parents=True, exist_ok=True)
            args.raw_output.write_text(
                json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
            )
        if args.require_all and any(result["status"] != "MEASURED" for result in results.values()):
            return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
