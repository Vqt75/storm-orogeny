"""Measure locked development architecture latency for Top-3 and Top-5 on the same cases."""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import numpy as np
import torch

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "semantic"))
from adapters import SentenceTransformerBenchmarkAdapter  # noqa: E402
from artifacts import MODEL_SPECS  # noqa: E402
from common import knowledge_text, load_nli, nli_pair, score_pairs, summary, validate_payload  # noqa: E402


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
    validate_payload(payload, "development")
    sample = []
    for label in ("covered", "notCovered", "ambiguous"):
        sample.extend([case for case in payload["cases"] if case["label"] == label][:12])
    retriever = SentenceTransformerBenchmarkAdapter(selection["retrieverKey"], args.retriever_path.resolve(), "cpu", 16)
    retriever.load()
    tokenizer, model, _ = load_nli(selection["modelKey"], args.nli_path.resolve())
    entries_list = payload["entries"]
    entries = {entry["entryId"]: entry for entry in entries_list}
    representation = selection["representation"]
    passage_vectors = retriever.encode_passages([knowledge_text(entry, representation) for entry in entries_list])
    spec = MODEL_SPECS[selection["modelKey"]]
    result = {}
    for top_k in (3, 5):
        retrieval_ms, nli_ms, total_ms = [], [], []
        for case in sample:
            total_started = time.perf_counter()
            started = time.perf_counter()
            query_vector = retriever.encode_queries([case["formulation"]], batch_size=1)[0]
            similarities = passage_vectors @ query_vector
            order = np.argsort(-similarities, kind="stable")[:top_k]
            retrieval_ms.append((time.perf_counter() - started) * 1000)
            candidate_ids = [entries_list[int(index)]["entryId"] for index in order]
            pairs = [nli_pair(case["formulation"], knowledge_text(entries[entry_id], representation), selection["direction"]) for entry_id in candidate_ids]
            started = time.perf_counter()
            score_pairs(tokenizer, model, pairs, spec["benchmarkMaxLength"], top_k, spec["labelIds"])
            nli_ms.append((time.perf_counter() - started) * 1000)
            total_ms.append((time.perf_counter() - total_started) * 1000)
        result[f"top{top_k}"] = {
            "cases": len(sample), "retrievalWarmMilliseconds": summary(retrieval_ms),
            "nliWarmMilliseconds": summary(nli_ms), "totalWarmMilliseconds": summary(total_ms),
        }
    args.output.write_text(json.dumps(result), encoding="utf-8")


if __name__ == "__main__":
    main()
