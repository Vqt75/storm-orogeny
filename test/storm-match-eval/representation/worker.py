"""Measure four knowledge representations with one pinned local retriever."""

from __future__ import annotations

import argparse
import importlib.metadata
import json
import os
import platform
import sys
import time
from pathlib import Path
from typing import Any

import numpy as np
import psutil
import torch

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "semantic"))
from adapters import SentenceTransformerBenchmarkAdapter, compute_artifact_fingerprint  # noqa: E402

REPRESENTATIONS = ("question", "answer", "questionAnswer", "multi")


def validate_payload(payload: dict[str, Any]) -> None:
    if len(payload["entries"]) != 112 or len(payload["officialCases"]) != 290:
        raise ValueError("Official representation corpus mismatch")
    if len(payload["decisionPositiveCases"]) != 100 or len(payload["priorHoldoutMissIds"]) != 16:
        raise ValueError("Decision-positive representation corpus mismatch")
    known = {entry["entryId"] for entry in payload["entries"]}
    if any(case["expectedEntryId"] not in known for case in payload["officialCases"] + payload["decisionPositiveCases"]):
        raise ValueError("Unknown expected entryId")


def metric_group(results: list[dict[str, Any]]) -> dict[str, Any]:
    output = {"cases": len(results)}
    for rank in (1, 3, 5):
        count = sum(item["case"]["expectedEntryId"] in item["topEntryIds"][:rank] for item in results)
        output[f"recallAt{rank}"] = count
        output[f"recallAt{rank}Rate"] = round(count / len(results), 6) if results else 0
    return output


def metrics(results: list[dict[str, Any]], grouping: str) -> dict[str, Any]:
    overall = metric_group(results)
    by_group = {}
    values = dict.fromkeys(item["case"].get(grouping) for item in results)
    for value in values:
        by_group[value] = metric_group([item for item in results if item["case"].get(grouping) == value])
    overall["byGroup"] = by_group
    return overall


def rank_cases(entry_scores, entries, cases, representation_labels=None):
    order = np.argsort(-entry_scores, axis=1, kind="stable")[:, :5]
    output = []
    for row, case in enumerate(cases):
        top_indices = order[row]
        item = {
            "case": case,
            "topEntryIds": [entries[int(index)]["entryId"] for index in top_indices],
            "topScores": [round(float(entry_scores[row, int(index)]), 7) for index in top_indices],
        }
        if representation_labels is not None:
            item["winningRepresentations"] = [representation_labels[row][int(index)] for index in top_indices]
        output.append(item)
    return output


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-key", required=True)
    parser.add_argument("--model-path", type=Path, required=True)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--cpu-threads", type=int, default=6)
    parser.add_argument("--batch-size", type=int, default=16)
    args = parser.parse_args()
    torch.set_num_threads(args.cpu_threads)
    payload = json.loads(args.input.read_text(encoding="utf-8"))
    validate_payload(payload)
    entries = payload["entries"]
    official = payload["officialCases"]
    decision = payload["decisionPositiveCases"]
    all_cases = official + decision
    process = psutil.Process(os.getpid())
    before = process.memory_info().rss
    adapter = SentenceTransformerBenchmarkAdapter(args.model_key, args.model_path.resolve(), "cpu", args.batch_size)
    started = time.perf_counter()
    adapter.load()
    load_ms = (time.perf_counter() - started) * 1000
    loaded = process.memory_info().rss
    started = time.perf_counter()
    query_vectors = adapter.encode_queries([case["formulation"] for case in all_cases])
    query_ms = (time.perf_counter() - started) * 1000
    texts = {
        "question": [entry["question"] for entry in entries],
        "answer": [entry["answer"] for entry in entries],
        "questionAnswer": [f"Question canonique : {entry['question']}\nRéponse canonique : {entry['answer']}" for entry in entries],
    }
    vectors, vectorization_ms = {}, {}
    for key, values in texts.items():
        started = time.perf_counter()
        vectors[key] = adapter.encode_passages(values)
        vectorization_ms[key] = round((time.perf_counter() - started) * 1000, 3)
    representation_results = {}
    for representation in REPRESENTATIONS:
        labels = None
        if representation == "multi":
            stacked = np.stack([query_vectors @ vectors[key].T for key in ("question", "answer", "questionAnswer")])
            scores = np.max(stacked, axis=0)
            winners = np.argmax(stacked, axis=0)
            names = np.array(["question", "answer", "questionAnswer"])
            labels = names[winners]
        else:
            scores = query_vectors @ vectors[representation].T
        ranked = rank_cases(scores, entries, all_cases, labels)
        official_results = ranked[: len(official)]
        decision_results = ranked[len(official) :]
        prior_misses = [item for item in decision_results if item["case"]["id"] in payload["priorHoldoutMissIds"]]
        representation_results[representation] = {
            "official": metrics(official_results, "category"),
            "decisionPositive": metrics(decision_results, "type"),
            "priorHoldoutMisses": metric_group(prior_misses),
            "priorHoldoutMissResults": prior_misses,
        }
    artifact = adapter.artifact
    artifact["artifactFingerprint"] = compute_artifact_fingerprint(args.model_path.resolve(), artifact["weightFiles"])
    output = {
        "status": "MEASURED", "modelKey": args.model_key,
        "model": {"modelId": adapter.spec["modelId"], "artifact": artifact},
        "representations": representation_results,
        "performance": {
            "modelLoadMilliseconds": round(load_ms, 3), "all390QueriesMilliseconds": round(query_ms, 3),
            "canonical112VectorizationMilliseconds": vectorization_ms,
            "rssBeforeMiB": round(before / 1024 / 1024, 2), "rssLoadedMiB": round(loaded / 1024 / 1024, 2),
            "rssEndMiB": round(process.memory_info().rss / 1024 / 1024, 2),
        },
        "hardware": {"processor": platform.processor() or platform.machine(), "cpuThreads": args.cpu_threads},
        "software": {
            "python": platform.python_version(), "torch": torch.__version__,
            "sentence-transformers": importlib.metadata.version("sentence-transformers"),
            "transformers": importlib.metadata.version("transformers"),
        },
        "corpusFingerprint": payload["corpusFingerprint"], "decisionFingerprint": payload["decisionFingerprint"],
    }
    args.output.write_text(json.dumps(output, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
