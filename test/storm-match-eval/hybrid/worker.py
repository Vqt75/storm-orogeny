"""Load one local semantic model and calibrate the test-only hybrid matcher."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

import numpy as np

HERE = Path(__file__).resolve().parent
SEMANTIC_DIR = HERE.parent / "semantic"
sys.path.insert(0, str(SEMANTIC_DIR))

from adapters import SentenceTransformerBenchmarkAdapter, compute_artifact_fingerprint  # noqa: E402
from calibration import calibrate  # noqa: E402


def validate_payload(payload: dict[str, Any]) -> None:
    entries = payload.get("entries", [])
    cases = payload.get("cases", [])
    if len(entries) != 112 or len({entry["entryId"] for entry in entries}) != 112:
        raise ValueError("Hybrid benchmark requires exactly 112 canonical entries")
    if len(cases) != 320 or len({case["id"] for case in cases}) != 320:
        raise ValueError("Hybrid benchmark requires exactly the official 320 cases")
    if sum(case.get("expectedEntryId") is not None for case in cases) != 290:
        raise ValueError("Hybrid benchmark requires exactly 290 resolvable cases")
    if sum(case.get("ambiguityClassification") == "trueAmbiguous" for case in cases) != 10:
        raise ValueError("Hybrid benchmark requires exactly 10 true-ambiguous cases")
    if sum(case["category"] == "hors_corpus" for case in cases) != 20:
        raise ValueError("Hybrid benchmark requires exactly 20 out-of-corpus cases")
    normalization = payload.get("lexicalNormalization", {})
    if normalization.get("highConfidenceScore") != 28:
        raise ValueError("Lexical normalization must remain anchored to engine threshold 28")
    if normalization.get("mediumConfidenceScore") != 18:
        raise ValueError("Lexical support must remain anchored to engine threshold 18")


def lexical_matrix(payload: dict[str, Any], entry_ids: list[str]) -> np.ndarray:
    matrix = []
    expected = set(entry_ids)
    for case in payload["cases"]:
        candidates = {candidate["entryId"]: candidate for candidate in case["lexicalCandidates"]}
        if set(candidates) != expected:
            raise ValueError(f"{case['id']}: lexical candidates do not cover the 112 entries")
        row = [float(candidates[entry_id]["normalizedScore"]) for entry_id in entry_ids]
        matrix.append(row)
    result = np.asarray(matrix, dtype=np.float32)
    if not np.all((result >= 0) & (result <= 1)):
        raise ValueError("Lexical normalization escaped [0,1]")
    return result


def pure_semantic_metrics(
    semantic_scores: np.ndarray, cases: list[dict[str, Any]], entry_ids: list[str]
) -> dict[str, Any]:
    entry_index = {entry_id: index for index, entry_id in enumerate(entry_ids)}
    order = np.argsort(-semantic_scores, axis=1, kind="stable")
    categories: dict[str, dict[str, Any]] = {}
    for category in dict.fromkeys(case["category"] for case in cases):
        indices = [
            index
            for index, case in enumerate(cases)
            if case["category"] == category and case.get("expectedEntryId") is not None
        ]
        if not indices:
            continue
        top1 = sum(
            int(order[index, 0]) == entry_index[cases[index]["expectedEntryId"]]
            for index in indices
        )
        top3 = sum(
            entry_index[cases[index]["expectedEntryId"]] in order[index, :3]
            for index in indices
        )
        categories[category] = {
            "cases": len(indices),
            "top1": top1,
            "top1Rate": round(top1 / len(indices), 6),
            "top3": top3,
            "top3Rate": round(top3 / len(indices), 6),
        }
    resolvable = [index for index, case in enumerate(cases) if case.get("expectedEntryId")]
    top1 = sum(
        int(order[index, 0]) == entry_index[cases[index]["expectedEntryId"]]
        for index in resolvable
    )
    top3 = sum(
        entry_index[cases[index]["expectedEntryId"]] in order[index, :3]
        for index in resolvable
    )
    semantic_correct = {
        index
        for index in resolvable
        if int(order[index, 0]) == entry_index[cases[index]["expectedEntryId"]]
    }
    heuristic_correct = {
        index for index in resolvable if cases[index]["heuristic"]["top1Correct"]
    }
    return {
        "top1Resolvable": top1,
        "top1Rate": round(top1 / 290, 6),
        "top3Resolvable": top3,
        "top3Rate": round(top3 / 290, 6),
        "byCategory": categories,
        "heuristicFailuresCorrected": len(semantic_correct - heuristic_correct),
        "newErrorsVersusHeuristic": len(heuristic_correct - semantic_correct),
        "outOfCorpusForcedNeighbors": 20,
        "trueAmbiguousForcedNeighbors": 10,
    }


def run(args: argparse.Namespace) -> dict[str, Any]:
    os.environ["HF_HUB_OFFLINE"] = "1"
    os.environ["TRANSFORMERS_OFFLINE"] = "1"
    os.environ["HF_DATASETS_OFFLINE"] = "1"
    os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"
    os.environ["TOKENIZERS_PARALLELISM"] = "false"

    import torch

    if args.device != "cpu":
        raise ValueError("Liquid Core V0 hybrid benchmark is CPU-only")
    torch.set_num_threads(args.cpu_threads)
    payload = json.loads(args.input.read_text(encoding="utf-8"))
    validate_payload(payload)
    entries = payload["entries"]
    cases = payload["cases"]
    entry_ids = [entry["entryId"] for entry in entries]

    adapter = SentenceTransformerBenchmarkAdapter(
        args.model_key, args.model_path, args.device, args.batch_size
    )
    adapter.load()
    corpus_vectors = adapter.encode_passages([entry["question"] for entry in entries])
    query_vectors = adapter.encode_queries([case["formulation"] for case in cases])
    semantic_scores = np.clip(query_vectors @ corpus_vectors.T, 0.0, 1.0)
    lexical_scores = lexical_matrix(payload, entry_ids)
    lexical_support = float(payload["lexicalNormalization"]["mediumSupportNormalized"])
    calibration = calibrate(
        semantic_scores, lexical_scores, cases, entry_ids, lexical_support
    )
    artifact_fingerprint = compute_artifact_fingerprint(
        adapter.model_path, adapter.artifact["weightFiles"]
    )
    return {
        "status": "MEASURED",
        "model": {
            "key": args.model_key,
            "modelId": adapter.spec["modelId"],
            "artifactFingerprint": artifact_fingerprint,
            "dimension": adapter.spec["dimension"],
            "maxSequenceLength": adapter.spec["maxSequenceLength"],
        },
        "corpus": {
            "fingerprint": payload["corpusFingerprint"],
            "entries": len(entries),
            "cases": len(cases),
        },
        "lexicalNormalization": payload["lexicalNormalization"],
        "semanticOnly": pure_semantic_metrics(semantic_scores, cases, entry_ids),
        "calibration": calibration,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-key", required=True, choices=["e5-small", "distiluse-cased-v2"])
    parser.add_argument("--model-path", required=True, type=Path)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--cpu-threads", type=int, default=max(1, (os.cpu_count() or 2) // 2))
    parser.add_argument("--batch-size", type=int, default=16)
    return parser.parse_args()


if __name__ == "__main__":
    parsed = parse_args()
    result = run(parsed)
    parsed.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
