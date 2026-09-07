"""Shared offline-only primitives for the test-only answerability NLI spike."""

from __future__ import annotations

import os
import statistics
import threading
from pathlib import Path
from typing import Any

os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
os.environ.setdefault("HF_DATASETS_OFFLINE", "1")
os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")


def percentile(values: list[float], p: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    position = (len(ordered) - 1) * p / 100
    lower = int(position)
    upper = min(lower + 1, len(ordered) - 1)
    fraction = position - lower
    return ordered[lower] * (1 - fraction) + ordered[upper] * fraction


def summary(values: list[float]) -> dict[str, float | None]:
    return {
        "mean": round(statistics.fmean(values), 3) if values else None,
        "p50": round(percentile(values, 50), 3) if values else None,
        "p95": round(percentile(values, 95), 3) if values else None,
        "min": round(min(values), 3) if values else None,
        "max": round(max(values), 3) if values else None,
    }


def mib(value: int | float) -> float:
    return round(value / (1024 * 1024), 2)


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


def validate_payload(payload: dict[str, Any], phase: str) -> None:
    if payload.get("phase") != phase or len(payload.get("entries", [])) != 112:
        raise ValueError("Unexpected answerability payload phase or canonical corpus size")
    cases = payload.get("cases", [])
    expected = 200 if phase == "development" else 96
    if len(cases) != expected:
        raise ValueError(f"{phase}: expected exactly {expected} isolated cases")
    labels = {label: sum(case.get("label") == label for case in cases) for label in ("covered", "notCovered", "ambiguous")}
    contract = {"covered": 100, "notCovered": 80, "ambiguous": 20} if phase == "development" else {"covered": 32, "notCovered": 32, "ambiguous": 32}
    if labels != contract:
        raise ValueError(f"{phase}: label contract mismatch: {labels!r}")
    if phase == "development" and payload.get("answerabilityHoldoutFingerprint") is not None:
        raise ValueError("Development export must not expose the new holdout fingerprint")
    if phase == "holdout" and not payload.get("answerabilityHoldoutFingerprint"):
        raise ValueError("Holdout export must carry its sealed fingerprint")


def knowledge_text(entry: dict[str, str], representation: str) -> str:
    if representation == "question":
        return entry["question"]
    if representation == "questionAnswer":
        return f"Question canonique : {entry['question']}\nRéponse canonique : {entry['answer']}"
    raise ValueError(f"Unknown representation: {representation}")


def nli_pair(query: str, knowledge: str, direction: str) -> tuple[str, str]:
    if direction == "knowledgeToQuery":
        return knowledge, query
    if direction == "queryToKnowledge":
        return query, knowledge
    raise ValueError(f"Unknown NLI direction: {direction}")


def load_nli(model_key: str, model_path: Path):
    from transformers import AutoModelForSequenceClassification, AutoTokenizer
    from artifacts import MODEL_SPECS, validate_artifact

    artifact = validate_artifact(model_key, model_path)
    spec = MODEL_SPECS[model_key]
    tokenizer = AutoTokenizer.from_pretrained(str(model_path), local_files_only=True, trust_remote_code=False)
    model = AutoModelForSequenceClassification.from_pretrained(
        str(model_path), local_files_only=True, trust_remote_code=False
    )
    model.eval()
    if type(model).__name__ != spec["architecture"]:
        raise ValueError(f"{model_key}: loaded architecture mismatch")
    return tokenizer, model, artifact


def score_pairs(tokenizer, model, pairs: list[tuple[str, str]], max_length: int, batch_size: int, label_ids: dict[str, int]):
    import torch

    output = []
    with torch.inference_mode():
        for start in range(0, len(pairs), batch_size):
            batch = pairs[start:start + batch_size]
            encoded = tokenizer(
                [item[0] for item in batch], [item[1] for item in batch], padding=True,
                truncation=True, max_length=max_length, return_tensors="pt",
            )
            probabilities = torch.softmax(model(**encoded, return_dict=True).logits, dim=-1).cpu()
            for row in probabilities:
                output.append({
                    label: round(float(row[index]), 7)
                    for label, index in label_ids.items()
                })
    return output
