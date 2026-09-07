"""Run one retained retriever over official + calibration cases only."""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

import numpy as np
import psutil
import torch

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "semantic"))
from adapters import SentenceTransformerBenchmarkAdapter  # noqa: E402
from common import RssSampler, mib, summary, validate_payload  # noqa: E402


def ranked_cases(adapter, entries, cases):
    questions = [entry["question"] for entry in entries]
    started = time.perf_counter()
    passage_vectors = adapter.encode_passages(questions)
    canonical_ms = (time.perf_counter() - started) * 1000
    query_vectors = adapter.encode_queries([case["formulation"] for case in cases])
    similarities = query_vectors @ passage_vectors.T
    order = np.argsort(-similarities, axis=1, kind="stable")[:, :5]
    results = []
    for row, case in enumerate(cases):
        candidates = [
            {"entryId": entries[int(index)]["entryId"], "similarity": round(float(similarities[row, index]), 7)}
            for index in order[row]
        ]
        results.append({"case": case, "candidates": candidates})
    return results, canonical_ms


def retrieval_metrics(results):
    positives = [item for item in results if item["case"].get("expectedEntryId")]
    metrics = {"cases": len(positives)}
    for rank in (1, 3, 5):
        correct = sum(
            item["case"]["expectedEntryId"] in [c["entryId"] for c in item["candidates"][:rank]]
            for item in positives
        )
        metrics[f"recallAt{rank}"] = correct
        metrics[f"recallAt{rank}Rate"] = round(correct / len(positives), 6) if positives else 0
    return metrics


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
    validate_payload(payload, "calibration")
    process = psutil.Process(os.getpid())
    sampler = RssSampler(process)
    sampler.start()
    before = process.memory_info().rss
    adapter = SentenceTransformerBenchmarkAdapter(args.model_key, args.model_path.resolve(), "cpu", args.batch_size)
    started = time.perf_counter()
    adapter.load()
    load_ms = (time.perf_counter() - started) * 1000
    loaded = process.memory_info().rss
    official, canonical_ms = ranked_cases(adapter, payload["entries"], payload["officialCases"])
    decision, _ = ranked_cases(adapter, payload["entries"], payload["decisionCases"])
    timings = []
    for case in payload["decisionCases"][:40]:
        started = time.perf_counter()
        adapter.encode_queries([case["formulation"]], batch_size=1)
        timings.append((time.perf_counter() - started) * 1000)
    peak = sampler.finish()
    result = {
        "status": "MEASURED", "modelKey": args.model_key,
        "official": official, "decisionCalibration": decision,
        "metrics": {
            "official": retrieval_metrics(official),
            "decisionCalibration": retrieval_metrics(decision),
        },
        "performance": {
            "modelLoadMilliseconds": round(load_ms, 3),
            "canonical112VectorizationMilliseconds": round(canonical_ms, 3),
            "warmQueryMilliseconds": summary(timings),
            "rssBeforeMiB": mib(before), "rssLoadedMiB": mib(loaded), "rssPeakMiB": mib(peak),
        },
        "corpusFingerprint": payload["corpusFingerprint"],
        "decisionFingerprint": payload["decisionFingerprint"],
    }
    args.output.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
