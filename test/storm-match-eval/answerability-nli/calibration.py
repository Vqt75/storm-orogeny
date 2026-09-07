"""Development-only calibration for independent NLI entailment decisions."""

from __future__ import annotations

import math
from typing import Any


def classify_item(item: dict[str, Any], top_k: int, threshold: float) -> dict[str, Any]:
    candidates = item["candidates"][:top_k]
    entailed = [candidate for candidate in candidates if candidate["nli"]["entailment"] >= threshold]
    if not entailed:
        predicted_label, matched = "notCovered", None
    elif len(entailed) == 1:
        predicted_label, matched = "covered", entailed[0]["entryId"]
    else:
        predicted_label, matched = "ambiguous", None
    expected = item["case"].get("expectedEntryId")
    expected_in_k = expected in [candidate["entryId"] for candidate in candidates] if expected else False
    exact = (
        matched == expected if item["case"]["label"] == "covered"
        else predicted_label == item["case"]["label"]
    )
    return {
        **item, "candidates": candidates, "entailed": entailed,
        "predictedLabel": predicted_label, "matchedEntryId": matched,
        "exactCorrect": exact, "expectedInK": expected_in_k,
    }


def evaluate(items: list[dict[str, Any]], top_k: int, threshold: float) -> dict[str, Any]:
    results = [classify_item(item, top_k, threshold) for item in items]
    by_label, by_type = {}, {}
    for field, target in (("label", by_label), ("type", by_type)):
        for name in dict.fromkeys(item["case"][field] for item in results):
            group = [item for item in results if item["case"][field] == name]
            target[name] = {
                "cases": len(group), "exactCorrect": sum(item["exactCorrect"] for item in group),
                "predictedCovered": sum(item["predictedLabel"] == "covered" for item in group),
                "predictedNotCovered": sum(item["predictedLabel"] == "notCovered" for item in group),
                "predictedAmbiguous": sum(item["predictedLabel"] == "ambiguous" for item in group),
                "coveredCorrect": sum(item["case"]["label"] == "covered" and item["exactCorrect"] for item in group),
            }
    covered = [item for item in results if item["case"]["label"] == "covered"]
    rejected = [item for item in results if item["case"]["label"] != "covered"]
    false_positives = [item for item in rejected if item["predictedLabel"] == "covered"]
    severity = {
        level: sum(item["case"].get("risk") == level for item in false_positives)
        for level in ("weak", "medium", "dangerous")
    }
    return {
        "entailmentThreshold": round(threshold, 7), "cases": len(results),
        "exactAccuracy": sum(item["exactCorrect"] for item in results),
        "coveredCases": len(covered), "coveredTop1Correct": sum(item["exactCorrect"] for item in covered),
        "notCoveredCases": by_label.get("notCovered", {}).get("cases", 0),
        "ambiguousCases": by_label.get("ambiguous", {}).get("cases", 0),
        "falsePositives": len(false_positives), "falsePositiveSeverity": severity,
        "overAbstentions": sum(item["predictedLabel"] != "covered" for item in covered),
        "wrongCoveredMatches": sum(item["predictedLabel"] == "covered" and not item["exactCorrect"] for item in covered),
        "retrievalMisses": sum(not item["expectedInK"] for item in covered),
        "nliErrorsWhenExpectedRetrieved": sum(item["expectedInK"] and not item["exactCorrect"] for item in covered),
        "ambiguousSafelyRejected": sum(item["case"]["label"] == "ambiguous" and item["predictedLabel"] != "covered" for item in results),
        "notCoveredSafelyRejected": sum(item["case"]["label"] == "notCovered" and item["predictedLabel"] != "covered" for item in results),
        "byLabel": by_label, "byType": by_type, "results": results,
    }


def meets_v0(metrics: dict[str, Any]) -> bool:
    covered = metrics["byLabel"]["covered"]["cases"]
    paraphrase = metrics["byType"]["paraphrase_naturelle"]
    different = metrics["byType"]["vocabulaire_different"]
    not_covered = metrics["byLabel"]["notCovered"]["cases"]
    ambiguous = metrics["byLabel"]["ambiguous"]
    return (
        metrics["coveredTop1Correct"] >= math.ceil(covered * 0.75)
        and paraphrase["coveredCorrect"] >= math.ceil(paraphrase["cases"] * 0.75)
        and different["coveredCorrect"] >= math.ceil(different["cases"] * 0.50)
        and metrics["falsePositiveSeverity"]["dangerous"] == 0
        and metrics["byLabel"]["notCovered"]["predictedCovered"] <= math.floor(not_covered * 0.15)
        and ambiguous["predictedCovered"] == 0
    )


def objective(metrics: dict[str, Any]) -> tuple:
    by_type = metrics["byType"]
    return (
        bool(metrics.get("meetsV0")), metrics["coveredTop1Correct"],
        by_type["paraphrase_naturelle"]["coveredCorrect"],
        by_type["vocabulaire_different"]["coveredCorrect"],
        by_type["synonymes"]["coveredCorrect"],
        by_type["adjacentButResolvable"]["coveredCorrect"],
        metrics["byLabel"]["ambiguous"]["exactCorrect"],
        metrics["byLabel"]["notCovered"]["exactCorrect"],
        -metrics["falsePositives"], -metrics["wrongCoveredMatches"],
        -metrics["overAbstentions"], -metrics["entailmentThreshold"],
    )


def calibrate(items: list[dict[str, Any]], top_k: int) -> dict[str, Any]:
    values = sorted({candidate["nli"]["entailment"] for item in items for candidate in item["candidates"][:top_k]})
    thresholds = [0.0, *values, math.nextafter(max(values), math.inf)]
    admissible = []
    v0_count = 0
    for threshold in thresholds:
        metrics = evaluate(items, top_k, threshold)
        if metrics["falsePositiveSeverity"]["dangerous"]:
            continue
        metrics["meetsV0"] = meets_v0(metrics)
        v0_count += int(metrics["meetsV0"])
        admissible.append(metrics)
    if not admissible:
        raise RuntimeError("Abstain-all must always provide one safety-admissible threshold")
    selected = max(admissible, key=objective)
    return {
        "thresholdCandidates": len(thresholds), "admissibleConfigurations": len(admissible),
        "v0Configurations": v0_count, "selected": selected,
    }
