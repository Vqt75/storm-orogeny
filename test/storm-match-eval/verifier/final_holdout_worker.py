"""The single, final holdout pass after calibration selection is locked."""

from __future__ import annotations

import argparse
import importlib.metadata
import json
import os
import platform
import sys
import time
from pathlib import Path

import numpy as np
import psutil
import torch

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "semantic"))
from adapters import SentenceTransformerBenchmarkAdapter  # noqa: E402
from calibration import evaluate, rank_item  # noqa: E402
from common import RssSampler, load_verifier, mib, score_pairs, summary, validate_payload, verifier_pairs  # noqa: E402
from artifacts import MODEL_SPECS  # noqa: E402


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--selection", type=Path, required=True)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--retriever-path", type=Path, required=True)
    parser.add_argument("--verifier-path", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--cpu-threads", type=int, default=6)
    args = parser.parse_args()
    torch.set_num_threads(args.cpu_threads)
    selection = json.loads(args.selection.read_text(encoding="utf-8"))
    payload = json.loads(args.input.read_text(encoding="utf-8"))
    validate_payload(payload, "holdout")
    if selection.get("decisionFingerprint") != payload["decisionFingerprint"]:
        raise ValueError("Selection and holdout decision fingerprints differ")
    process = psutil.Process(os.getpid())
    sampler = RssSampler(process)
    sampler.start()
    before = process.memory_info().rss
    retriever = SentenceTransformerBenchmarkAdapter(
        selection["retrieverKey"], args.retriever_path.resolve(), "cpu", 16
    )
    started = time.perf_counter()
    retriever.load()
    retriever_load_ms = (time.perf_counter() - started) * 1000
    started = time.perf_counter()
    tokenizer, verifier, artifact = load_verifier(selection["verifierKey"], args.verifier_path.resolve())
    verifier_load_ms = (time.perf_counter() - started) * 1000
    loaded = process.memory_info().rss
    entries_list = payload["entries"]
    entries = {entry["entryId"]: entry for entry in entries_list}
    started = time.perf_counter()
    passage_vectors = retriever.encode_passages([entry["question"] for entry in entries_list])
    vectorization_ms = (time.perf_counter() - started) * 1000
    k = selection["topK"]
    contract = selection["contract"]
    max_length = MODEL_SPECS[selection["verifierKey"]]["benchmarkMaxLength"]
    scored = []
    retrieval_timings, verifier_timings, total_timings = [], [], []
    for case in payload["decisionCases"]:
        total_started = time.perf_counter()
        started = time.perf_counter()
        vector = retriever.encode_queries([case["formulation"]], batch_size=1)[0]
        similarities = passage_vectors @ vector
        order = np.argsort(-similarities, kind="stable")[:k]
        retrieval_timings.append((time.perf_counter() - started) * 1000)
        candidate_ids = [entries_list[int(index)]["entryId"] for index in order]
        pairs = verifier_pairs(case["formulation"], entries, candidate_ids, contract)
        started = time.perf_counter()
        scores = score_pairs(tokenizer, verifier, pairs, max_length, k)
        verifier_timings.append((time.perf_counter() - started) * 1000)
        candidates = [
            {"entryId": entry_id, "similarity": round(float(similarities[int(index)]), 7), "verifierScore": round(float(score), 7)}
            for entry_id, index, score in zip(candidate_ids, order, scores)
        ]
        scored.append({"case": case, "candidates": candidates})
        total_timings.append((time.perf_counter() - total_started) * 1000)
    ranked = [rank_item(item, k) for item in scored]
    metrics = evaluate(ranked, selection["scoreThreshold"], selection["marginThreshold"])
    peak = sampler.finish()
    metrics["meetsV0"] = (
        metrics["top1Correct"] >= 30
        and metrics["byType"]["paraphrase_naturelle"]["matchedCorrectly"] >= 8
        and metrics["byType"]["vocabulaire_different"]["matchedCorrectly"] >= 5
        and metrics["falsePositiveSeverity"]["dangerous"] == 0
        and metrics["falsePositiveTypes"].get("clearOutOfCorpus", 0) == 0
        and metrics["byType"]["trueAmbiguous"]["accepted"] == 0
    )
    output = {
        "status": "MEASURED", "holdoutPasses": 1, "selection": selection,
        "metrics": metrics, "artifact": artifact,
        "performance": {
            "retrieverLoadMilliseconds": round(retriever_load_ms, 3),
            "verifierLoadMilliseconds": round(verifier_load_ms, 3),
            "combinedColdStartMilliseconds": round(retriever_load_ms + verifier_load_ms, 3),
            "canonical112VectorizationMilliseconds": round(vectorization_ms, 3),
            "retrievalWarmMilliseconds": summary(retrieval_timings),
            "verifierWarmMilliseconds": summary(verifier_timings),
            "totalWarmMilliseconds": summary(total_timings),
            "rssBeforeMiB": mib(before), "rssBothLoadedMiB": mib(loaded), "rssPeakMiB": mib(peak),
        },
        "hardware": {
            "processor": platform.processor() or platform.machine(),
            "physicalCores": psutil.cpu_count(logical=False), "logicalCores": psutil.cpu_count(logical=True),
            "cpuThreadsUsed": args.cpu_threads,
        },
        "software": {
            "python": platform.python_version(), "torch": torch.__version__,
            "transformers": importlib.metadata.version("transformers"),
            "sentence-transformers": importlib.metadata.version("sentence-transformers"),
        },
    }
    args.output.write_text(json.dumps(output, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
