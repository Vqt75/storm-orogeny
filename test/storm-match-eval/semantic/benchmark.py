"""Orchestrate isolated pure-semantic runs and render one comparison report."""

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

from adapters import MODEL_SPECS, validate_local_artifact
from worker import validate_corpus

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[2]
MODEL_ORDER = ["e5-small", "multilingual-minilm", "distiluse-cased-v2"]
CATEGORY_LABELS = {
    "quasi_identique": "Quasi-identique",
    "paraphrase_naturelle": "Paraphrase naturelle",
    "conversationnel": "Conversationnel",
    "formulation_courte": "Formulation courte",
    "synonymes": "Synonymes",
    "vocabulaire_different": "DifferentVocab",
    "syntaxe_imparfaite": "Syntaxe imparfaite",
    "faute_de_frappe": "Fautes de frappe",
    "mots_cles_seuls": "Mots-clés seuls",
}


def parse_model_argument(value: str) -> tuple[str, Path]:
    key, separator, raw_path = value.partition("=")
    if not separator or key not in MODEL_SPECS or not raw_path:
        raise argparse.ArgumentTypeError("Expected a known model key followed by an absolute path: key=/path")
    return key, Path(raw_path).expanduser()


def collect_model_paths(args: argparse.Namespace) -> dict[str, Path]:
    paths: dict[str, Path] = {}
    if args.config:
        configured = json.loads(args.config.read_text(encoding="utf-8")).get("models", {})
        for key, value in configured.items():
            if key not in MODEL_SPECS:
                raise ValueError(f"Unknown model key in config: {key}")
            paths[key] = Path(value).expanduser()
    for key, path in args.model:
        paths[key] = path
    return paths


def export_input(node_binary: str, output: Path) -> dict[str, Any]:
    command = [node_binary, str(HERE / "export-input.mjs")]
    completed = subprocess.run(
        command, cwd=REPO_ROOT, capture_output=True, text=True, encoding="utf-8", check=True
    )
    payload = json.loads(completed.stdout)
    output.write_text(json.dumps(payload, ensure_ascii=False) + "\n", encoding="utf-8")
    return payload


def run_worker(args, model_key: str, model_path: Path, input_path: Path, output_path: Path) -> dict[str, Any]:
    environment = os.environ.copy()
    environment.update({
        "HF_HUB_OFFLINE": "1",
        "TRANSFORMERS_OFFLINE": "1",
        "HF_DATASETS_OFFLINE": "1",
        "HF_HUB_DISABLE_TELEMETRY": "1",
        "TOKENIZERS_PARALLELISM": "false",
    })
    command = [
        sys.executable,
        str(HERE / "worker.py"),
        "--model-key", model_key,
        "--model-path", str(model_path.resolve()),
        "--input", str(input_path),
        "--diagnostics", str(HERE / "multilingual-diagnostic.json"),
        "--output", str(output_path),
        "--device", args.device,
        "--batch-size", str(args.batch_size),
        "--cpu-threads", str(args.cpu_threads),
    ]
    completed = subprocess.run(
        command, cwd=REPO_ROOT, env=environment, capture_output=True, text=True, encoding="utf-8"
    )
    if completed.returncode != 0:
        detail = (completed.stderr or completed.stdout).strip().splitlines()
        return {
            "status": "FAILED",
            "model": {"key": model_key, "modelId": MODEL_SPECS[model_key]["modelId"], "path": str(model_path)},
            "reason": detail[-1] if detail else f"worker exited with {completed.returncode}",
        }
    return json.loads(output_path.read_text(encoding="utf-8"))


def percent_metric(metric: dict[str, Any], rank: str) -> str:
    count = metric.get(rank)
    cases = metric.get("cases")
    rate = metric.get(rank + "Rate")
    if count is None or not cases or rate is None:
        return "—"
    return f"{count}/{cases} ({rate * 100:.1f}%)"


def number(value: Any, suffix: str = "") -> str:
    return "—" if value is None else f"{value}{suffix}"


def measured_value(result: dict[str, Any], getter) -> str:
    if result.get("status") != "MEASURED":
        return "—"
    return getter(result)


def render_table(results: dict[str, dict[str, Any]]) -> list[str]:
    columns = [results[key] for key in MODEL_ORDER]
    headers = [MODEL_SPECS[key]["modelId"] for key in MODEL_ORDER]
    rows: list[tuple[str, list[str]]] = []

    def add(label: str, getter) -> None:
        rows.append((label, [measured_value(result, getter) for result in columns]))

    rows.append(("Statut", [result["status"] for result in columns]))
    add("Dimensions", lambda result: str(result["model"]["dimension"]))
    add("Longueur maximale", lambda result: str(result["model"]["maxSequenceLength"]))
    add("Poids réellement sélectionnés", lambda result: number(result["model"]["weightsMiB"], " MiB"))
    add("Artefact local total", lambda result: number(result["model"]["artifactMiB"], " MiB"))
    add("RAM processus après chargement", lambda result: number(result["performance"]["loadedIdleProcessRssMiB"], " MiB"))
    add("RAM incrémentale après chargement", lambda result: number(result["performance"]["loadedIdleDeltaMiB"], " MiB"))
    add("Pic RAM processus benchmark", lambda result: number(result["performance"]["benchmarkPeakProcessRssMiB"], " MiB"))
    add("Chargement modèle", lambda result: number(result["performance"]["modelLoadMilliseconds"], " ms"))
    add("Première requête à froid (modèle chargé)", lambda result: number(result["performance"]["coldFirstQueryMilliseconds"], " ms"))
    add("Cold start chargement + première requête", lambda result: number(result["performance"]["coldLoadThroughFirstQueryMilliseconds"], " ms"))
    add("Vectorisation des 112 questions", lambda result: number(result["performance"]["canonical112VectorizationMilliseconds"], " ms"))
    add("Requête chaude moyenne", lambda result: number(result["performance"]["warmQueryMilliseconds"]["mean"], " ms"))
    add("Requête chaude p50", lambda result: number(result["performance"]["warmQueryMilliseconds"]["p50"], " ms"))
    add("Requête chaude p95", lambda result: number(result["performance"]["warmQueryMilliseconds"]["p95"], " ms"))
    add("Top-1 résoluble", lambda result: percent_metric(result["retrieval"]["resolvable"], "top1"))
    add("Top-3 résoluble", lambda result: percent_metric(result["retrieval"]["resolvable"], "top3"))
    add("Résoluble similarité Top-1 moyenne", lambda result: number(result["retrieval"]["resolvable"]["top1Similarity"]["mean"]))
    add("Résoluble marge p50", lambda result: number(result["retrieval"]["resolvable"]["marginTop1Top2"]["p50"]))
    add("Résoluble marge p95", lambda result: number(result["retrieval"]["resolvable"]["marginTop1Top2"]["p95"]))

    for category, label in CATEGORY_LABELS.items():
        add(f"{label} Top-1", lambda result, category=category: percent_metric(result["retrieval"]["byCategory"][category], "top1"))
        add(f"{label} Top-3", lambda result, category=category: percent_metric(result["retrieval"]["byCategory"][category], "top3"))

    add("Adjacent résoluble Top-1", lambda result: percent_metric(result["retrieval"]["adjacentButResolvable"], "top1"))
    add("Adjacent résoluble Top-3", lambda result: percent_metric(result["retrieval"]["adjacentButResolvable"], "top3"))
    add("TrueAmbiguous similarité Top-1 moyenne", lambda result: number(result["retrieval"]["trueAmbiguous"]["top1Similarity"]["mean"]))
    add("TrueAmbiguous similarité Top-1 p95", lambda result: number(result["retrieval"]["trueAmbiguous"]["top1Similarity"]["p95"]))
    add("TrueAmbiguous similarité Top-1 max", lambda result: number(result["retrieval"]["trueAmbiguous"]["top1Similarity"]["max"]))
    add("TrueAmbiguous marge p50", lambda result: number(result["retrieval"]["trueAmbiguous"]["marginTop1Top2"]["p50"]))
    add("Hors corpus similarité Top-1 moyenne", lambda result: number(result["retrieval"]["outOfCorpus"]["top1Similarity"]["mean"]))
    add("Hors corpus similarité Top-1 p95", lambda result: number(result["retrieval"]["outOfCorpus"]["top1Similarity"]["p95"]))
    add("Hors corpus similarité Top-1 max", lambda result: number(result["retrieval"]["outOfCorpus"]["top1Similarity"]["max"]))
    add("Hors corpus marge p50", lambda result: number(result["retrieval"]["outOfCorpus"]["marginTop1Top2"]["p50"]))
    add("Hors corpus marge p95", lambda result: number(result["retrieval"]["outOfCorpus"]["marginTop1Top2"]["p95"]))

    for language in ["fr", "en", "nl", "es"]:
        add(f"Diagnostic {language} Top-1", lambda result, language=language: percent_metric(result["multilingualDiagnostic"]["byLanguage"][language], "top1"))
        add(f"Diagnostic {language} Top-3", lambda result, language=language: percent_metric(result["multilingualDiagnostic"]["byLanguage"][language], "top3"))

    lines = [
        "| métrique | " + " | ".join(headers) + " |",
        "|---|" + "|".join("---" for _ in headers) + "|",
    ]
    for label, values in rows:
        lines.append("| " + label + " | " + " | ".join(value.replace("|", "\\|") for value in values) + " |")
    return lines


def example_line(result: dict[str, Any]) -> str:
    case = result["case"]
    top = ", ".join(
        f"{candidate['entryId']}={candidate['similarity']:.4f}"
        for candidate in result["topCandidates"][:2]
    )
    return (
        f"- `{case['id']}` — {case['formulation']} — expected `{case.get('expectedEntryId')}`; "
        f"heuristic `{case['heuristic']['matchedEntryId']}`; semantic {top}; "
        f"margin={result['marginTop1Top2']:.4f}."
    )


def render_examples(results: dict[str, dict[str, Any]]) -> list[str]:
    lines = []
    sections = [
        ("Échecs heuristiques corrigés", "heuristicFailuresCorrected"),
        ("Nouvelles erreurs par rapport à l’heuristique", "newErrorsVersusHeuristic"),
        ("Top-1 et Top-2 les plus proches", "closestTop1Top2"),
        ("Hors corpus avec les similarités les plus élevées", "highestOutOfCorpusSimilarity"),
    ]
    for key in MODEL_ORDER:
        result = results[key]
        lines.extend(["", f"### {MODEL_SPECS[key]['modelId']}", ""])
        if result["status"] != "MEASURED":
            lines.append(f"Non mesuré : {result.get('reason', 'modèle local non configuré')}.")
            continue
        for title, field in sections:
            lines.extend(["", f"#### {title}", ""])
            examples = result["examples"][field]
            lines.extend(example_line(item) for item in examples) if examples else lines.append("Aucun cas.")
    return lines


def render_report(results: dict[str, dict[str, Any]], payload: dict[str, Any], args) -> str:
    measured = [result for result in results.values() if result["status"] == "MEASURED"]
    baseline_git_hash = subprocess.run(
        [args.git, "log", "-1", "--format=%H", "--", "test/storm-match-eval/report-baseline.txt"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=True,
    ).stdout.strip()
    lines = [
        "# Storm Match — benchmark sémantique pur V0",
        "",
        f"- Commit de la baseline heuristique : `{baseline_git_hash}`",
        f"- Corpus officiel : `{payload['corpusFingerprint']}`",
        "- Questions canoniques : 112",
        "- Cas officiels : 320, dont 290 résolubles, 10 trueAmbiguous et 20 hors corpus",
        "- Retrieval : similarité cosinus sur les seules questions canoniques",
        "- Abstention : non évaluée ; chaque embedding retourne toujours un voisin",
        "- Score lexical/hybride : absent",
        f"- Modèles mesurés : {len(measured)}/3",
        "",
        "## Comparatif",
        "",
        *render_table(results),
        "",
        "## Contrats imposés par les adapters",
        "",
    ]
    for key in MODEL_ORDER:
        spec = MODEL_SPECS[key]
        prefixes = f"query=`{spec['queryPrefix']}`, passage=`{spec['passagePrefix']}`" if spec["queryPrefix"] else "aucun préfixe"
        pipeline = " → ".join(item.rsplit(".", 1)[-1] for item in spec["moduleTypes"])
        lines.append(
            f"- `{spec['modelId']}` : {pipeline}, pooling {spec['pooling']}, "
            f"{spec['normalization']}, {prefixes}, max {spec['maxSequenceLength']} tokens, {spec['dimension']} dimensions."
        )

    lines.extend(["", "## Environnement et versions", ""])
    for key in MODEL_ORDER:
        result = results[key]
        if result["status"] == "MEASURED":
            hardware = result["hardware"]
            software = result["software"]
            lines.append(
                f"- `{key}` : {hardware['processor']}; {hardware['physicalCores']} cœurs physiques / "
                f"{hardware['logicalCores']} logiques; device={result['performance']['device']}; "
                f"threads={result['performance']['cpuThreads']}; "
                f"torch={software['torch']}; sentence-transformers={software['sentence-transformers']}; "
                f"transformers={software['transformers']}; artifact={result['model']['artifactFingerprint']}."
            )
        else:
            lines.append(f"- `{key}` : {result['status']} — {result.get('reason', 'non configuré')}.")

    lines.extend(["", "## Exemples diagnostiques"])
    lines.extend(render_examples(results))
    lines.extend([
        "",
        "## Sanity check multilingue",
        "",
        "Les 24 formulations françaises, anglaises, néerlandaises et espagnoles sont diagnostiques seulement et ne contribuent à aucun score officiel V0.",
        "",
        "## Décision",
        "",
    ])
    if not measured:
        lines.append("Aucune recommandation : aucun des trois modèles n’a été exécuté avec ses poids locaux dans cet environnement.")
    elif len(measured) < 3:
        lines.append("Aucune recommandation comparative : les trois modèles n’ont pas tous été mesurés dans le même environnement.")
    else:
        lines.append("Aucune recommandation automatique : la décision doit être prise à partir des mesures ci-dessus.")
    return "\n".join(lines) + "\n"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", action="append", type=parse_model_argument, default=[], metavar="KEY=PATH")
    parser.add_argument("--config", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--raw-output", type=Path)
    parser.add_argument("--node", default=shutil.which("node") or "node")
    parser.add_argument("--git", default=shutil.which("git") or "git")
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--cpu-threads", type=int, default=max(1, (os.cpu_count() or 2) // 2))
    parser.add_argument("--validate-only", action="store_true")
    parser.add_argument("--require-all", action="store_true")
    return parser.parse_args()


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    args = parse_args()
    model_paths = collect_model_paths(args)
    diagnostics = json.loads((HERE / "multilingual-diagnostic.json").read_text(encoding="utf-8"))

    with tempfile.TemporaryDirectory(prefix="storm-semantic-benchmark-") as temporary:
        temporary_path = Path(temporary)
        input_path = temporary_path / "input.json"
        payload = export_input(args.node, input_path)
        validate_corpus(payload, diagnostics)

        if args.validate_only:
            artifacts = {
                key: validate_local_artifact(key, path.resolve())
                for key, path in model_paths.items()
            }
            print(json.dumps({
                "valid": True,
                "corpusFingerprint": payload["corpusFingerprint"],
                "entries": len(payload["entries"]),
                "cases": len(payload["cases"]),
                "configuredArtifacts": list(artifacts),
            }, indent=2))
            return 0

        results: dict[str, dict[str, Any]] = {}
        for key in MODEL_ORDER:
            path = model_paths.get(key)
            if path is None:
                results[key] = {
                    "status": "NOT_RUN",
                    "model": {"key": key, "modelId": MODEL_SPECS[key]["modelId"]},
                    "reason": "local model path not configured",
                }
            elif not path.expanduser().is_dir():
                results[key] = {
                    "status": "NOT_RUN",
                    "model": {"key": key, "modelId": MODEL_SPECS[key]["modelId"], "path": str(path)},
                    "reason": "local model directory not found",
                }
            else:
                output_path = temporary_path / f"{key}.json"
                results[key] = run_worker(args, key, path.expanduser(), input_path, output_path)

        report = render_report(results, payload, args)
        if args.output:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(report, encoding="utf-8")
        else:
            sys.stdout.write(report)
        if args.raw_output:
            args.raw_output.parent.mkdir(parents=True, exist_ok=True)
            args.raw_output.write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

        if args.require_all and any(result["status"] != "MEASURED" for result in results.values()):
            return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
