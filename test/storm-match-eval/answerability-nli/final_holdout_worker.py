"""One final sealed-holdout pass for one development-locked NLI architecture."""

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
from artifacts import MODEL_SPECS  # noqa: E402
from calibration import evaluate, meets_v0  # noqa: E402
from common import RssSampler, knowledge_text, load_nli, mib, nli_pair, score_pairs, summary, validate_payload  # noqa: E402


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--selection", type=Path, required=True)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--retriever-path", type=Path, required=True)
    parser.add_argument("--nli-path", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--cpu-threads", type=int, default=6)
    args = parser.parse_args()
    torch.set_num_threads(args.cpu_threads)
    selection = json.loads(args.selection.read_text(encoding="utf-8"))
    payload = json.loads(args.input.read_text(encoding="utf-8"))
    validate_payload(payload, "holdout")
    if selection["answerabilityHoldoutFingerprint"] != payload["answerabilityHoldoutFingerprint"]:
        raise ValueError("Locked selection and sealed holdout fingerprints differ")
    process = psutil.Process(os.getpid())
    sampler = RssSampler(process)
    sampler.start()
    before = process.memory_info().rss
    retriever = SentenceTransformerBenchmarkAdapter(selection["retrieverKey"], args.retriever_path.resolve(), "cpu", 16)
    started = time.perf_counter()
    retriever.load()
    retriever_load_ms = (time.perf_counter() - started) * 1000
    started = time.perf_counter()
    tokenizer, model, artifact = load_nli(selection["modelKey"], args.nli_path.resolve())
    nli_load_ms = (time.perf_counter() - started) * 1000
    loaded = process.memory_info().rss
    entries_list = payload["entries"]
    entries = {entry["entryId"]: entry for entry in entries_list}
    representation = selection["representation"]
    started = time.perf_counter()
    passage_vectors = retriever.encode_passages([knowledge_text(entry, representation) for entry in entries_list])
    vectorization_ms = (time.perf_counter() - started) * 1000
    spec = MODEL_SPECS[selection["modelKey"]]
    scored, retrieval_timings, nli_timings, total_timings = [], [], [], []
    for case in payload["cases"]:
        total_started = time.perf_counter()
        started = time.perf_counter()
        query_vector = retriever.encode_queries([case["formulation"]], batch_size=1)[0]
        similarities = passage_vectors @ query_vector
        order = np.argsort(-similarities, kind="stable")[:selection["topK"]]
        retrieval_timings.append((time.perf_counter() - started) * 1000)
        candidate_ids = [entries_list[int(index)]["entryId"] for index in order]
        pairs = [nli_pair(case["formulation"], knowledge_text(entries[entry_id], representation), selection["direction"]) for entry_id in candidate_ids]
        started = time.perf_counter()
        probabilities = score_pairs(tokenizer, model, pairs, spec["benchmarkMaxLength"], selection["topK"], spec["labelIds"])
        nli_timings.append((time.perf_counter() - started) * 1000)
        candidates = [
            {"entryId": entry_id, "similarity": round(float(similarities[int(index)]), 7), "nli": probability}
            for entry_id, index, probability in zip(candidate_ids, order, probabilities)
        ]
        scored.append({"case": case, "candidates": candidates})
        total_timings.append((time.perf_counter() - total_started) * 1000)
    metrics = evaluate(scored, selection["topK"], selection["entailmentThreshold"])
    metrics["meetsV0"] = meets_v0(metrics)
    peak = sampler.finish()
    args.output.write_text(json.dumps({
        "status": "MEASURED", "holdoutPasses": 1, "selection": selection,
        "metrics": metrics, "artifact": artifact,
        "performance": {
            "retrieverLoadMilliseconds": round(retriever_load_ms, 3),
            "nliLoadMilliseconds": round(nli_load_ms, 3),
            "combinedColdStartMilliseconds": round(retriever_load_ms + nli_load_ms, 3),
            "canonical112VectorizationMilliseconds": round(vectorization_ms, 3),
            "retrievalWarmMilliseconds": summary(retrieval_timings),
            "nliWarmMilliseconds": summary(nli_timings),
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
    }, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
