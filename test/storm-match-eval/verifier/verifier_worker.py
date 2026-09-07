"""Score retrieved calibration pairs with one external local reranker."""

from __future__ import annotations

import argparse
import json
import os
import time
from pathlib import Path

import psutil
import torch

from artifacts import MODEL_SPECS
from common import RssSampler, load_verifier, mib, score_pairs, summary, verifier_pairs, validate_payload


def score_dataset(tokenizer, model, source, entries, contract, max_length, batch_size):
    flat_pairs = []
    widths = []
    for item in source:
        ids = [candidate["entryId"] for candidate in item["candidates"]]
        pairs = verifier_pairs(item["case"]["formulation"], entries, ids, contract)
        flat_pairs.extend(pairs)
        widths.append(len(pairs))
    flat_scores = score_pairs(tokenizer, model, flat_pairs, max_length, batch_size)
    results = []
    cursor = 0
    for item, width in zip(source, widths):
        candidates = []
        for candidate, score in zip(item["candidates"], flat_scores[cursor:cursor + width]):
            candidates.append({**candidate, "verifierScore": round(float(score), 7)})
        cursor += width
        candidates.sort(key=lambda value: (-value["verifierScore"], -value["similarity"], value["entryId"]))
        results.append({"case": item["case"], "candidates": candidates})
    return results


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
    validate_payload(payload, "calibration")
    entries = {entry["entryId"]: entry for entry in payload["entries"]}
    retrievals = {item["modelKey"]: item for item in (
        json.loads(path.read_text(encoding="utf-8")) for path in args.retrieval
    )}
    process = psutil.Process(os.getpid())
    sampler = RssSampler(process)
    sampler.start()
    before = process.memory_info().rss
    started = time.perf_counter()
    tokenizer, model, artifact = load_verifier(args.model_key, args.model_path.resolve())
    load_ms = (time.perf_counter() - started) * 1000
    loaded = process.memory_info().rss
    max_length = MODEL_SPECS[args.model_key]["benchmarkMaxLength"]
    scores = {}
    latency = {}
    for retriever_key, retrieval in retrievals.items():
        scores[retriever_key] = {}
        latency[retriever_key] = {}
        for contract in ("question", "questionAnswer"):
            scores[retriever_key][contract] = {
                "official": score_dataset(tokenizer, model, retrieval["official"], entries, contract, max_length, args.batch_size),
                "decisionCalibration": score_dataset(tokenizer, model, retrieval["decisionCalibration"], entries, contract, max_length, args.batch_size),
            }
            latency[retriever_key][contract] = {}
            sample = retrieval["decisionCalibration"][:32]
            for k in (3, 5):
                timings = []
                for item in sample:
                    ids = [candidate["entryId"] for candidate in item["candidates"][:k]]
                    pairs = verifier_pairs(item["case"]["formulation"], entries, ids, contract)
                    started = time.perf_counter()
                    score_pairs(tokenizer, model, pairs, max_length, k)
                    timings.append((time.perf_counter() - started) * 1000)
                latency[retriever_key][contract][f"top{k}"] = summary(timings)
    peak = sampler.finish()
    result = {
        "status": "MEASURED", "modelKey": args.model_key, "artifact": artifact,
        "scores": scores, "latency": latency,
        "performance": {
            "modelLoadMilliseconds": round(load_ms, 3), "rssBeforeMiB": mib(before),
            "rssLoadedMiB": mib(loaded), "rssPeakMiB": mib(peak),
        },
    }
    args.output.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
