"""Score every retrieved development pair in both NLI directions."""

from __future__ import annotations

import argparse
import importlib.metadata
import json
import os
import platform
import time
from pathlib import Path

import psutil
import torch

from artifacts import MODEL_SPECS
from common import RssSampler, knowledge_text, load_nli, mib, nli_pair, score_pairs, validate_payload

RETRIEVERS = ("e5-small", "distiluse-cased-v2")
REPRESENTATIONS = ("question", "questionAnswer")
DIRECTIONS = ("knowledgeToQuery", "queryToKnowledge")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-key", required=True)
    parser.add_argument("--model-path", type=Path, required=True)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--retrieval", action="append", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--cpu-threads", type=int, default=6)
    parser.add_argument("--batch-size", type=int, default=16)
    args = parser.parse_args()
    torch.set_num_threads(args.cpu_threads)
    payload = json.loads(args.input.read_text(encoding="utf-8"))
    validate_payload(payload, "development")
    retrievals = {item["modelKey"]: item for path in args.retrieval for item in [json.loads(path.read_text(encoding="utf-8"))]}
    if set(retrievals) != set(RETRIEVERS):
        raise ValueError("Exactly both retained retrievers are required")
    entries = {entry["entryId"]: entry for entry in payload["entries"]}
    process = psutil.Process(os.getpid())
    sampler = RssSampler(process)
    sampler.start()
    before = process.memory_info().rss
    started = time.perf_counter()
    tokenizer, model, artifact = load_nli(args.model_key, args.model_path.resolve())
    load_ms = (time.perf_counter() - started) * 1000
    loaded = process.memory_info().rss
    spec = MODEL_SPECS[args.model_key]
    scores = {}
    scoring_performance = {}
    for retriever_key in RETRIEVERS:
        scores[retriever_key] = {}
        scoring_performance[retriever_key] = {}
        for representation in REPRESENTATIONS:
            source = retrievals[retriever_key]["representations"][representation]["results"]
            scores[retriever_key][representation] = {}
            scoring_performance[retriever_key][representation] = {}
            for direction in DIRECTIONS:
                pairs = []
                for item in source:
                    query = item["case"]["formulation"]
                    for candidate in item["candidates"]:
                        pairs.append(nli_pair(query, knowledge_text(entries[candidate["entryId"]], representation), direction))
                started = time.perf_counter()
                probabilities = score_pairs(
                    tokenizer, model, pairs, spec["benchmarkMaxLength"], args.batch_size, spec["labelIds"]
                )
                elapsed_ms = (time.perf_counter() - started) * 1000
                cursor = 0
                output_items = []
                for item in source:
                    candidates = []
                    for candidate in item["candidates"]:
                        candidates.append({**candidate, "nli": probabilities[cursor]})
                        cursor += 1
                    output_items.append({"case": item["case"], "candidates": candidates})
                scores[retriever_key][representation][direction] = output_items
                scoring_performance[retriever_key][representation][direction] = {
                    "pairs": len(pairs), "milliseconds": round(elapsed_ms, 3),
                    "millisecondsPerPair": round(elapsed_ms / len(pairs), 4),
                }
    peak = sampler.finish()
    args.output.write_text(json.dumps({
        "status": "MEASURED", "modelKey": args.model_key, "artifact": artifact,
        "scores": scores, "scoringPerformance": scoring_performance,
        "performance": {
            "modelLoadMilliseconds": round(load_ms, 3), "rssBeforeMiB": mib(before),
            "rssLoadedMiB": mib(loaded), "rssPeakMiB": mib(peak),
        },
        "hardware": {
            "processor": platform.processor() or platform.machine(),
            "physicalCores": psutil.cpu_count(logical=False), "logicalCores": psutil.cpu_count(logical=True),
            "cpuThreadsUsed": args.cpu_threads,
        },
        "software": {
            "python": platform.python_version(), "torch": torch.__version__,
            "transformers": importlib.metadata.version("transformers"),
        },
        "priorDecisionFingerprint": payload["priorDecisionFingerprint"],
    }, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
