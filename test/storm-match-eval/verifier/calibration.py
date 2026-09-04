"""Calibration-only selection for retrieve -> rerank/verify -> abstain."""

from __future__ import annotations

import math
from typing import Any


def rank_item(item: dict[str, Any], k: int) -> dict[str, Any]:
    retrieved = sorted(item["candidates"], key=lambda value: (-value["similarity"], value["entryId"]))[:k]
    ranked = sorted(retrieved, key=lambda value: (-value["verifierScore"], -value["similarity"], value["entryId"]))
    top = ranked[0]
    margin = top["verifierScore"] - ranked[1]["verifierScore"] if len(ranked) > 1 else top["verifierScore"]
    expected = item["case"].get("expectedEntryId")
    return {
        "case": item["case"], "ranked": ranked, "top": top,
        "margin": margin, "expectedInK": expected in [value["entryId"] for value in retrieved] if expected else False,
        "retrievalTop1Correct": bool(expected and retrieved[0]["entryId"] == expected),
    }


def evaluate(ranked: list[dict[str, Any]], score_threshold: float, margin_threshold: float) -> dict[str, Any]:
    results = []
    for item in ranked:
        accepted = item["top"]["verifierScore"] >= score_threshold and item["margin"] >= margin_threshold
        expected = item["case"].get("expectedEntryId")
        matched = item["top"]["entryId"] if accepted else None
        correct = matched == expected if expected else not accepted
        results.append({**item, "accepted": accepted, "matchedEntryId": matched, "correct": correct})
    positives = [item for item in results if item["case"].get("expectedEntryId")]
    negatives = [item for item in results if not item["case"].get("expectedEntryId")]
    accepted_negatives = [item for item in negatives if item["accepted"]]
    by_type = {}
    for type_name in dict.fromkeys(item["case"]["type"] for item in results):
        group = [item for item in results if item["case"]["type"] == type_name]
        group_positives = [item for item in group if item["case"].get("expectedEntryId")]
        by_type[type_name] = {
            "cases": len(group),
            "correct": sum(item["correct"] for item in group),
            "accepted": sum(item["accepted"] for item in group),
            "matchedCorrectly": sum(item["correct"] for item in group_positives),
            "abstained": sum(not item["accepted"] for item in group),
        }
    severity = {level: sum(item["case"].get("risk") == level for item in accepted_negatives) for level in ("weak", "medium", "dangerous")}
    correct_positives = sum(item["correct"] for item in positives)
    false_positive_types = {}
    for item in accepted_negatives:
        key = item["case"]["type"]
        false_positive_types[key] = false_positive_types.get(key, 0) + 1
    return {
        "scoreThreshold": round(score_threshold, 7), "marginThreshold": round(margin_threshold, 7),
        "positiveCases": len(positives), "top1Correct": correct_positives,
        "top1Rate": round(correct_positives / len(positives), 6) if positives else 0,
        "top3AfterRerank": sum(item["case"]["expectedEntryId"] in [value["entryId"] for value in item["ranked"][:3]] for item in positives),
        "retrievalMisses": sum(not item["expectedInK"] for item in positives),
        "verifierErrors": sum(item["expectedInK"] and item["top"]["entryId"] != item["case"]["expectedEntryId"] for item in positives),
        "overAbstentions": sum(not item["accepted"] for item in positives),
        "wrongPositiveMatches": sum(item["accepted"] and not item["correct"] for item in positives),
        "negativeCases": len(negatives), "negativeCorrectlyRejected": sum(not item["accepted"] for item in negatives),
        "falsePositives": len(accepted_negatives), "falsePositiveSeverity": severity,
        "falsePositiveTypes": false_positive_types,
        "trueAmbiguousRejected": by_type.get("trueAmbiguous", {}).get("abstained", 0),
        "clearOutOfCorpusRejected": by_type.get("clearOutOfCorpus", {}).get("abstained", 0),
        "hardNegativeRejected": by_type.get("hardNegative", {}).get("abstained", 0),
        "mixedIntentsRejected": by_type.get("mixedIntents", {}).get("abstained", 0),
        "correctionsVersusRetrievalTop1": sum(not item["retrievalTop1Correct"] and item["correct"] for item in positives),
        "newErrorsVersusRetrievalTop1": sum(item["retrievalTop1Correct"] and not item["correct"] for item in positives),
        "byType": by_type, "results": results,
    }


def _objective(metrics: dict[str, Any]) -> tuple:
    by_type = metrics["byType"]
    return (
        metrics["top1Correct"],
        by_type["paraphrase_naturelle"]["matchedCorrectly"],
        by_type["vocabulaire_different"]["matchedCorrectly"],
        by_type["synonymes"]["matchedCorrectly"],
        by_type["adjacentButResolvable"]["matchedCorrectly"],
        -metrics["falsePositiveSeverity"]["medium"],
        -metrics["falsePositiveSeverity"]["weak"],
        -metrics["wrongPositiveMatches"],
        -metrics["overAbstentions"],
        -metrics["newErrorsVersusRetrievalTop1"],
        -metrics["scoreThreshold"],
        -metrics["marginThreshold"],
    )


def calibrate(items: list[dict[str, Any]], k: int) -> dict[str, Any]:
    ranked = [rank_item(item, k) for item in items]
    score_values = sorted({item["top"]["verifierScore"] for item in ranked})
    margin_values = sorted({round(item["margin"], 7) for item in ranked})
    score_thresholds = score_values + [math.nextafter(max(score_values), math.inf)]
    margin_thresholds = margin_values + [math.nextafter(max(margin_values), math.inf)]
    best = None
    best_v0 = None
    admissible = 0
    v0_count = 0
    for score_threshold in score_thresholds:
        for margin_threshold in margin_thresholds:
            metrics = evaluate(ranked, score_threshold, margin_threshold)
            if metrics["falsePositiveSeverity"]["dangerous"] or metrics["falsePositiveTypes"].get("clearOutOfCorpus", 0) > 0:
                continue
            admissible += 1
            by_type = metrics["byType"]
            meets_v0 = (
                metrics["top1Correct"] >= 45
                and by_type["paraphrase_naturelle"]["matchedCorrectly"] >= 12
                and by_type["vocabulaire_different"]["matchedCorrectly"] >= 8
                and by_type["trueAmbiguous"]["accepted"] == 0
            )
            metrics["meetsV0"] = meets_v0
            if best is None or _objective(metrics) > _objective(best):
                best = metrics
            if meets_v0:
                v0_count += 1
                if best_v0 is None or _objective(metrics) > _objective(best_v0):
                    best_v0 = metrics
    selected = best_v0 or best
    if selected is None:
        raise RuntimeError("No calibration configuration satisfies the safety constraints")
    return {
        "scoreThresholdCandidates": len(score_thresholds),
        "marginThresholdCandidates": len(margin_thresholds),
        "evaluatedConfigurations": len(score_thresholds) * len(margin_thresholds),
        "admissibleConfigurations": admissible, "v0Configurations": v0_count,
        "selectedFromV0Set": best_v0 is not None, "selected": selected,
    }


def diagnostic_rerank(items: list[dict[str, Any]], k: int) -> dict[str, Any]:
    ranked = [rank_item(item, k) for item in items]
    positives = [item for item in ranked if item["case"].get("expectedEntryId")]
    return {
        "cases": len(positives),
        "top1": sum(item["top"]["entryId"] == item["case"]["expectedEntryId"] for item in positives),
        "top3": sum(item["case"]["expectedEntryId"] in [value["entryId"] for value in item["ranked"][:3]] for item in positives),
        "retrievalMisses": sum(not item["expectedInK"] for item in positives),
        "verifierErrors": sum(item["expectedInK"] and item["top"]["entryId"] != item["case"]["expectedEntryId"] for item in positives),
    }
