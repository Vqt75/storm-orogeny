"""Run one semantic model in an isolated process and emit JSON measurements."""

from __future__ import annotations

import argparse
import gc
import importlib.metadata
import json
import os
import platform
import statistics
import threading
import time
from pathlib import Path
from typing import Any

from adapters import SentenceTransformerBenchmarkAdapter, compute_artifact_fingerprint


def milliseconds(seconds: float) -> float:
    return round(seconds * 1000, 3)


def mib(value: int | float) -> float:
    return round(value / (1024 * 1024), 2)


def percentile(values: list[float], percentile_value: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    position = (len(ordered) - 1) * percentile_value / 100
    lower = int(position)
    upper = min(lower + 1, len(ordered) - 1)
    fraction = position - lower
    return ordered[lower] * (1 - fraction) + ordered[upper] * fraction


def summary(values: list[float]) -> dict[str, float | None]:
    return {
        "mean": round(statistics.fmean(values), 6) if values else None,
        "p50": round(percentile(values, 50), 6) if values else None,
        "p95": round(percentile(values, 95), 6) if values else None,
        "min": round(min(values), 6) if values else None,
        "max": round(max(values), 6) if values else None,
    }


class RssSampler:
    def __init__(self, process):
        self.process = process
        self.peak = process.memory_info().rss
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._sample, daemon=True)

    def start(self) -> None:
        self._thread.start()

    def finish(self) -> int:
        self._stop.set()
        self._thread.join()
        self.peak = max(self.peak, self.process.memory_info().rss)
        return self.peak

    def _sample(self) -> None:
        while not self._stop.wait(0.01):
            self.peak = max(self.peak, self.process.memory_info().rss)


def validate_corpus(payload: dict[str, Any], diagnostics: dict[str, Any]) -> None:
    entries = payload.get("entries", [])
    cases = payload.get("cases", [])
    entry_ids = {entry["entryId"] for entry in entries}
    if len(entries) != 112 or len(entry_ids) != 112:
        raise ValueError("Semantic benchmark requires exactly 112 distinct canonical questions")
    if len(cases) != 320 or len({case["id"] for case in cases}) != 320:
        raise ValueError("Semantic benchmark requires exactly the official 320 evaluation cases")
    if sum(case["category"] == "hors_corpus" for case in cases) != 20:
        raise ValueError("Semantic benchmark requires exactly 20 out-of-corpus cases")
    if sum(case.get("ambiguityClassification") == "trueAmbiguous" for case in cases) != 10:
        raise ValueError("Semantic benchmark requires exactly 10 true-ambiguous cases")
    if sum(case.get("expectedEntryId") is not None for case in cases) != 290:
        raise ValueError("Semantic benchmark requires exactly 290 resolvable cases")
    if diagnostics.get("officialScoreContribution") is not False:
        raise ValueError("Multilingual diagnostic cases must not contribute to the official score")
    if any(case["expectedEntryId"] not in entry_ids for case in diagnostics.get("cases", [])):
        raise ValueError("Multilingual diagnostic references an unknown fixture entry")


def rank(vector, corpus_vectors, entries: list[dict[str, str]]) -> dict[str, Any]:
    import numpy as np

    scores = corpus_vectors @ vector
    order = np.argsort(-scores, kind="stable")
    candidates = [
        {
            "entryId": entries[int(index)]["entryId"],
            "question": entries[int(index)]["question"],
            "similarity": round(float(scores[int(index)]), 6),
        }
        for index in order[:3]
    ]
    return {
        "topCandidates": candidates,
        "top1EntryId": candidates[0]["entryId"],
        "top1Similarity": candidates[0]["similarity"],
        "marginTop1Top2": round(candidates[0]["similarity"] - candidates[1]["similarity"], 6),
    }


def aggregate_group(results: list[dict[str, Any]], *, has_expected: bool) -> dict[str, Any]:
    metric = {
        "cases": len(results),
        "top1Similarity": summary([result["top1Similarity"] for result in results]),
        "marginTop1Top2": summary([result["marginTop1Top2"] for result in results]),
    }
    if has_expected:
        top1 = sum(result["semanticTop1Correct"] for result in results)
        top3 = sum(result["semanticTop3Correct"] for result in results)
        metric.update({
            "top1": top1,
            "top1Rate": round(top1 / len(results), 6) if results else None,
            "top3": top3,
            "top3Rate": round(top3 / len(results), 6) if results else None,
        })
    return metric


def evaluate_results(cases, query_vectors, corpus_vectors, entries):
    results = []
    for case, vector in zip(cases, query_vectors, strict=True):
        retrieval = rank(vector, corpus_vectors, entries)
        expected = case.get("expectedEntryId")
        top_ids = [candidate["entryId"] for candidate in retrieval["topCandidates"]]
        results.append({
            "case": case,
            **retrieval,
            "semanticTop1Correct": expected is not None and retrieval["top1EntryId"] == expected,
            "semanticTop3Correct": expected is not None and expected in top_ids,
        })
    return results


def retrieval_metrics(results: list[dict[str, Any]]) -> dict[str, Any]:
    resolvable = [result for result in results if result["case"].get("expectedEntryId") is not None]
    true_ambiguous = [
        result for result in results
        if result["case"].get("ambiguityClassification") == "trueAmbiguous"
    ]
    out_of_corpus = [result for result in results if result["case"]["category"] == "hors_corpus"]
    adjacent = [
        result for result in results
        if result["case"].get("ambiguityClassification") == "adjacentButResolvable"
    ]
    categories = {}
    for category in dict.fromkeys(result["case"]["category"] for result in results):
        group = [result for result in results if result["case"]["category"] == category]
        expected_group = [result for result in group if result["case"].get("expectedEntryId") is not None]
        categories[category] = aggregate_group(expected_group, has_expected=True) if expected_group else aggregate_group(group, has_expected=False)

    return {
        "resolvable": aggregate_group(resolvable, has_expected=True),
        "byCategory": categories,
        "adjacentButResolvable": aggregate_group(adjacent, has_expected=True),
        "trueAmbiguous": aggregate_group(true_ambiguous, has_expected=False),
        "outOfCorpus": aggregate_group(out_of_corpus, has_expected=False),
    }


def multilingual_metrics(diagnostic_cases, vectors, corpus_vectors, entries):
    results = evaluate_results(diagnostic_cases, vectors, corpus_vectors, entries)
    by_language = {}
    for language in dict.fromkeys(result["case"]["language"] for result in results):
        group = [result for result in results if result["case"]["language"] == language]
        by_language[language] = aggregate_group(group, has_expected=True)
    return {"officialScoreContribution": False, "byLanguage": by_language, "results": results}


def representative_examples(results: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    resolvable = [result for result in results if result["case"].get("expectedEntryId") is not None]
    corrections = [
        result for result in resolvable
        if not result["case"]["heuristic"]["top1Correct"] and result["semanticTop1Correct"]
    ][:10]
    regressions = [
        result for result in resolvable
        if result["case"]["heuristic"]["top1Correct"] and not result["semanticTop1Correct"]
    ][:10]
    close = sorted(results, key=lambda result: (result["marginTop1Top2"], result["case"]["id"]))[:10]
    out_of_corpus = sorted(
        (result for result in results if result["case"]["category"] == "hors_corpus"),
        key=lambda result: (-result["top1Similarity"], result["case"]["id"]),
    )[:10]
    return {
        "heuristicFailuresCorrected": corrections,
        "newErrorsVersusHeuristic": regressions,
        "closestTop1Top2": close,
        "highestOutOfCorpusSimilarity": out_of_corpus,
    }


def cpu_description(psutil_module) -> dict[str, Any]:
    name = platform.processor() or os.environ.get("PROCESSOR_IDENTIFIER") or "unknown"
    if name == "unknown" and Path("/proc/cpuinfo").is_file():
        for line in Path("/proc/cpuinfo").read_text(errors="ignore").splitlines():
            if line.lower().startswith("model name"):
                name = line.split(":", 1)[1].strip()
                break
    return {
        "processor": name,
        "machine": platform.machine(),
        "platform": platform.platform(),
        "physicalCores": psutil_module.cpu_count(logical=False),
        "logicalCores": psutil_module.cpu_count(logical=True),
    }


def run(args: argparse.Namespace) -> dict[str, Any]:
    try:
        import numpy as np
        import psutil
        import torch
    except ImportError as error:
        raise RuntimeError(
            "Missing semantic benchmark dependencies; install requirements-semantic.txt offline"
        ) from error

    if args.device == "cpu":
        torch.set_num_threads(args.cpu_threads)
    elif args.device.startswith("cuda") and not torch.cuda.is_available():
        raise RuntimeError(f"Requested device is unavailable: {args.device}")

    payload = json.loads(args.input.read_text(encoding="utf-8"))
    diagnostics = json.loads(args.diagnostics.read_text(encoding="utf-8"))
    validate_corpus(payload, diagnostics)

    process = psutil.Process()
    baseline_rss = process.memory_info().rss
    sampler = RssSampler(process)
    sampler.start()

    adapter = SentenceTransformerBenchmarkAdapter(args.model_key, args.model_path, args.device, args.batch_size)
    load_start = time.perf_counter()
    adapter.load()
    load_seconds = time.perf_counter() - load_start
    gc.collect()
    loaded_idle_rss = process.memory_info().rss

    cold_query = payload["cases"][0]["formulation"]
    cold_start = time.perf_counter()
    adapter.encode_queries([cold_query], batch_size=1)
    cold_query_seconds = time.perf_counter() - cold_start

    corpus_start = time.perf_counter()
    corpus_vectors = adapter.encode_passages([entry["question"] for entry in payload["entries"]])
    corpus_seconds = time.perf_counter() - corpus_start

    query_vectors = []
    query_seconds = []
    for case in payload["cases"]:
        query_start = time.perf_counter()
        vector = adapter.encode_queries([case["formulation"]], batch_size=1)[0]
        query_seconds.append(time.perf_counter() - query_start)
        query_vectors.append(vector)
    query_vectors = np.stack(query_vectors)

    diagnostic_vectors = adapter.encode_queries([case["query"] for case in diagnostics["cases"]])
    results = evaluate_results(payload["cases"], query_vectors, corpus_vectors, payload["entries"])
    diagnostic = multilingual_metrics(
        diagnostics["cases"], diagnostic_vectors, corpus_vectors, payload["entries"]
    )
    peak_rss = sampler.finish()
    artifact_fingerprint = compute_artifact_fingerprint(
        adapter.model_path, adapter.artifact["weightFiles"]
    )

    cuda_memory = None
    if args.device.startswith("cuda"):
        cuda_memory = {
            "allocatedMiB": mib(torch.cuda.memory_allocated()),
            "peakAllocatedMiB": mib(torch.cuda.max_memory_allocated()),
        }

    return {
        "status": "MEASURED",
        "model": {
            "key": args.model_key,
            "modelId": adapter.spec["modelId"],
            "path": str(adapter.model_path),
            "dimension": adapter.spec["dimension"],
            "maxSequenceLength": adapter.spec["maxSequenceLength"],
            "queryPrefix": adapter.spec["queryPrefix"],
            "passagePrefix": adapter.spec["passagePrefix"],
            "pooling": adapter.spec["pooling"],
            "postPooling": adapter.spec.get("postPooling"),
            "normalization": adapter.spec["normalization"],
            "artifactFingerprint": artifact_fingerprint,
            "artifactDescriptorFingerprint": adapter.artifact["artifactDescriptorFingerprint"],
            "weightFiles": adapter.artifact["weightFiles"],
            "weightsMiB": mib(adapter.artifact["weightsBytes"]),
            "artifactMiB": mib(adapter.artifact["artifactBytes"]),
        },
        "corpus": {
            "fingerprint": payload["corpusFingerprint"],
            "entries": len(payload["entries"]),
            "cases": len(payload["cases"]),
            "sourceGitCommit": payload["sourceGitCommit"],
        },
        "performance": {
            "device": args.device,
            "cpuThreads": torch.get_num_threads(),
            "baselineProcessRssMiB": mib(baseline_rss),
            "loadedIdleProcessRssMiB": mib(loaded_idle_rss),
            "loadedIdleDeltaMiB": mib(max(0, loaded_idle_rss - baseline_rss)),
            "benchmarkPeakProcessRssMiB": mib(peak_rss),
            "benchmarkPeakDeltaMiB": mib(max(0, peak_rss - baseline_rss)),
            "modelLoadMilliseconds": milliseconds(load_seconds),
            "coldFirstQueryMilliseconds": milliseconds(cold_query_seconds),
            "coldLoadThroughFirstQueryMilliseconds": milliseconds(load_seconds + cold_query_seconds),
            "canonical112VectorizationMilliseconds": milliseconds(corpus_seconds),
            "warmQueryMilliseconds": {
                "mean": milliseconds(statistics.fmean(query_seconds)),
                "p50": milliseconds(percentile(query_seconds, 50)),
                "p95": milliseconds(percentile(query_seconds, 95)),
                "samples": len(query_seconds),
            },
            "cudaMemory": cuda_memory,
        },
        "hardware": cpu_description(psutil),
        "software": {
            package: importlib.metadata.version(package)
            for package in ["numpy", "psutil", "sentence-transformers", "torch", "transformers"]
        },
        "retrieval": retrieval_metrics(results),
        "multilingualDiagnostic": diagnostic,
        "examples": representative_examples(results),
        "results": results,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-key", required=True)
    parser.add_argument("--model-path", type=Path, required=True)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--diagnostics", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--cpu-threads", type=int, default=max(1, (os.cpu_count() or 2) // 2))
    return parser.parse_args()


if __name__ == "__main__":
    parsed = parse_args()
    result = run(parsed)
    parsed.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
