"""Retrieve question-only and Q+A candidates for development without opening holdout."""

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
from common import RssSampler, knowledge_text, mib, summary, validate_payload  # noqa: E402


def retrieval_metrics(results):
    covered = [item for item in results if item["case"]["label"] == "covered"]
    output = {"coveredCases": len(covered)}
    for rank in (1, 3, 5):
        correct = sum(item["case"]["expectedEntryId"] in [candidate["entryId"] for candidate in item["candidates"][:rank]] for item in covered)
        output[f"recallAt{rank}"] = correct
        output[f"recallAt{rank}Rate"] = round(correct / len(covered), 6)
    by_type = {}
    for type_name in dict.fromkeys(item["case"]["type"] for item in covered):
        group = [item for item in covered if item["case"]["type"] == type_name]
        by_type[type_name] = {
            f"recallAt{rank}": sum(item["case"]["expectedEntryId"] in [candidate["entryId"] for candidate in item["candidates"][:rank]] for item in group)
            for rank in (1, 3, 5)
        } | {"cases": len(group)}
    output["byType"] = by_type
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
    validate_payload(payload, "development")
    process = psutil.Process(os.getpid())
    sampler = RssSampler(process)
    sampler.start()
    before = process.memory_info().rss
    adapter = SentenceTransformerBenchmarkAdapter(args.model_key, args.model_path.resolve(), "cpu", args.batch_size)
    started = time.perf_counter()
    adapter.load()
    load_ms = (time.perf_counter() - started) * 1000
    loaded = process.memory_info().rss
    entries = payload["entries"]
    cases = payload["cases"]
    started = time.perf_counter()
    query_vectors = adapter.encode_queries([case["formulation"] for case in cases])
    query_ms = (time.perf_counter() - started) * 1000
    representations = {}
    vectorization = {}
    for representation in ("question", "questionAnswer"):
        started = time.perf_counter()
        passage_vectors = adapter.encode_passages([knowledge_text(entry, representation) for entry in entries])
        vectorization[representation] = round((time.perf_counter() - started) * 1000, 3)
        similarities = query_vectors @ passage_vectors.T
        order = np.argsort(-similarities, axis=1, kind="stable")[:, :5]
        results = []
        for row, case in enumerate(cases):
            candidates = [
                {"entryId": entries[int(index)]["entryId"], "similarity": round(float(similarities[row, int(index)]), 7)}
                for index in order[row]
            ]
            results.append({"case": case, "candidates": candidates})
        representations[representation] = {"results": results, "metrics": retrieval_metrics(results)}
    timings = []
    for case in cases[:32]:
        started = time.perf_counter()
        adapter.encode_queries([case["formulation"]], batch_size=1)
        timings.append((time.perf_counter() - started) * 1000)
    peak = sampler.finish()
    args.output.write_text(json.dumps({
        "status": "MEASURED", "modelKey": args.model_key, "representations": representations,
        "performance": {
            "modelLoadMilliseconds": round(load_ms, 3), "all200QueriesMilliseconds": round(query_ms, 3),
            "canonical112VectorizationMilliseconds": vectorization, "warmQueryMilliseconds": summary(timings),
            "rssBeforeMiB": mib(before), "rssLoadedMiB": mib(loaded), "rssPeakMiB": mib(peak),
        },
        "priorDecisionFingerprint": payload["priorDecisionFingerprint"],
    }, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
