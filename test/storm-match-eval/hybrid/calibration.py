"""Deterministic grid calibration for the benchmark-only hybrid matcher."""

from __future__ import annotations

import math
from typing import Any

import numpy as np


WEIGHT_SEMANTIC_VALUES = tuple(round(value / 20, 3) for value in range(10, 20))
HIGH_MATCH_VALUES = tuple(round(value / 20, 3) for value in range(10, 20))
MEDIUM_MATCH_VALUES = tuple(round(value / 20, 3) for value in range(6, 18))
MARGIN_VALUES = tuple(round(value / 200, 3) for value in range(1, 31))
MINIMUM_SEMANTIC_VALUES = (None,) + tuple(round(value / 20, 3) for value in range(6, 18))


def _bits(mask: np.ndarray) -> int:
    value = 0
    for index in np.flatnonzero(mask):
        value |= 1 << int(index)
    return value


def _rate(value: int, total: int) -> float:
    return round(value / total, 6) if total else 0.0


def grid_contract() -> dict[str, Any]:
    high_medium_pairs = sum(
        medium < high for high in HIGH_MATCH_VALUES for medium in MEDIUM_MATCH_VALUES
    )
    configurations_per_ranking = (
        high_medium_pairs * len(MARGIN_VALUES) * len(MINIMUM_SEMANTIC_VALUES)
    )
    return {
        "weightSemantic": list(WEIGHT_SEMANTIC_VALUES),
        "weightLexical": [round(1 - value, 3) for value in WEIGHT_SEMANTIC_VALUES],
        "highMatchThreshold": list(HIGH_MATCH_VALUES),
        "mediumMatchThreshold": list(MEDIUM_MATCH_VALUES),
        "marginThreshold": list(MARGIN_VALUES),
        "minimumSemantic": list(MINIMUM_SEMANTIC_VALUES),
        "highMediumPairs": high_medium_pairs,
        "configurationsPerRanking": configurations_per_ranking,
        "totalConfigurations": configurations_per_ranking * len(WEIGHT_SEMANTIC_VALUES),
    }


def _category_bits(cases: list[dict[str, Any]]) -> dict[str, int]:
    categories: dict[str, int] = {}
    for index, case in enumerate(cases):
        categories[case["category"]] = categories.get(case["category"], 0) | (1 << index)
    return categories


def _ranking_for_weight(
    semantic_scores: np.ndarray,
    lexical_scores: np.ndarray,
    expected_indices: np.ndarray,
    weight_semantic: float,
) -> dict[str, Any]:
    weight_lexical = 1.0 - weight_semantic
    combined = (semantic_scores * weight_semantic) + (lexical_scores * weight_lexical)
    order = np.argsort(-combined, axis=1, kind="stable")
    rows = np.arange(combined.shape[0])
    top_indices = order[:, 0]
    second_indices = order[:, 1]
    top_scores = combined[rows, top_indices]
    second_scores = combined[rows, second_indices]
    top_semantic = semantic_scores[rows, top_indices]
    top_lexical = lexical_scores[rows, top_indices]
    top1_correct = (expected_indices >= 0) & (top_indices == expected_indices)
    top3_correct = (expected_indices >= 0) & np.any(
        order[:, :3] == expected_indices[:, None], axis=1
    )
    return {
        "combined": combined,
        "order": order,
        "topIndices": top_indices,
        "topScores": top_scores,
        "topSemantic": top_semantic,
        "topLexical": top_lexical,
        "margins": top_scores - second_scores,
        "top1Correct": top1_correct,
        "top3Correct": top3_correct,
        "weightSemantic": weight_semantic,
        "weightLexical": weight_lexical,
    }


def _configuration_metrics(
    *,
    accepted: int,
    high_path: int,
    ranking: dict[str, Any],
    masks: dict[str, int],
    categories: dict[str, int],
    lexical_high: int,
    configuration: dict[str, Any],
) -> dict[str, Any]:
    all_bits = masks["all"]
    final_correct = accepted & masks["rankingCorrect"]
    null_accepted = accepted & masks["nullExpected"]
    dangerous_null = null_accepted & (high_path | lexical_high)
    out_of_corpus_accepted = accepted & masks["outOfCorpus"]
    dangerous_out_of_corpus = dangerous_null & masks["outOfCorpus"]
    medium_out_of_corpus = out_of_corpus_accepted & ~dangerous_out_of_corpus
    weak_out_of_corpus = out_of_corpus_accepted & ~dangerous_out_of_corpus & ~medium_out_of_corpus
    ambiguity_errors = accepted & masks["trueAmbiguous"]
    over_abstentions = masks["resolvable"] & (all_bits ^ accepted)
    wrong_resolvable_matches = accepted & masks["resolvable"] & ~masks["rankingCorrect"]
    corrections = final_correct & ~masks["heuristicCorrect"]
    new_errors = masks["heuristicCorrect"] & ~final_correct

    top1 = final_correct.bit_count()
    paraphrase = (final_correct & categories["paraphrase_naturelle"]).bit_count()
    different_vocab = (final_correct & categories["vocabulaire_different"]).bit_count()
    synonyms = (final_correct & categories["synonymes"]).bit_count()
    out_of_corpus_false_positives = out_of_corpus_accepted.bit_count()
    ambiguity_error_count = ambiguity_errors.bit_count()
    dangerous_count = dangerous_null.bit_count()
    meets_v0 = (
        top1 >= math.ceil(0.75 * 290)
        and paraphrase >= math.ceil(0.75 * 30)
        and different_vocab >= math.ceil(0.50 * 30)
        and dangerous_count == 0
        and out_of_corpus_false_positives <= math.floor(0.15 * 20)
        and ambiguity_error_count == 0
    )

    return {
        "configuration": configuration,
        "meetsV0": meets_v0,
        "top1Resolvable": top1,
        "top3Resolvable": (masks["rankingTop3"] & masks["resolvable"]).bit_count(),
        "paraphrase": paraphrase,
        "synonyms": synonyms,
        "differentVocab": different_vocab,
        "adjacentButResolvable": (
            final_correct & masks["adjacentButResolvable"]
        ).bit_count(),
        "trueAmbiguousAbstentions": 10 - ambiguity_error_count,
        "trueAmbiguousErrors": ambiguity_error_count,
        "outOfCorpusAbstentions": 20 - out_of_corpus_false_positives,
        "outOfCorpusFalsePositives": out_of_corpus_false_positives,
        "falsePositiveSeverity": {
            "weak": weak_out_of_corpus.bit_count(),
            "medium": medium_out_of_corpus.bit_count(),
            "dangerous": dangerous_out_of_corpus.bit_count(),
        },
        "dangerousNullExpectedAccepts": dangerous_count,
        "overAbstentions": over_abstentions.bit_count(),
        "wrongResolvableMatches": wrong_resolvable_matches.bit_count(),
        "heuristicFailuresCorrected": corrections.bit_count(),
        "newErrorsVersusHeuristic": new_errors.bit_count(),
        "accepted": accepted.bit_count(),
        "abstained": 320 - accepted.bit_count(),
        "top1Rate": _rate(top1, 290),
        "top3Rate": _rate((masks["rankingTop3"] & masks["resolvable"]).bit_count(), 290),
    }


def _objective(metrics: dict[str, Any]) -> tuple[Any, ...]:
    return (
        metrics["top1Resolvable"],
        metrics["paraphrase"],
        metrics["differentVocab"],
        metrics["synonyms"],
        -metrics["outOfCorpusFalsePositives"],
        -metrics["trueAmbiguousErrors"],
        -metrics["overAbstentions"],
        -metrics["newErrorsVersusHeuristic"],
        metrics["top3Resolvable"],
        metrics["configuration"]["weightSemantic"],
        metrics["configuration"]["marginThreshold"],
    )


def calibrate(
    semantic_scores: np.ndarray,
    lexical_scores: np.ndarray,
    cases: list[dict[str, Any]],
    entry_ids: list[str],
    lexical_support: float,
) -> dict[str, Any]:
    if semantic_scores.shape != (320, 112) or lexical_scores.shape != (320, 112):
        raise ValueError("Hybrid calibration requires 320x112 semantic and lexical matrices")
    if not np.all((lexical_scores >= 0) & (lexical_scores <= 1)):
        raise ValueError("Lexical scores must be normalized to [0,1]")

    entry_index = {entry_id: index for index, entry_id in enumerate(entry_ids)}
    expected_indices = np.array(
        [entry_index[case["expectedEntryId"]] if case.get("expectedEntryId") else -1 for case in cases],
        dtype=np.int64,
    )
    all_bits = (1 << len(cases)) - 1
    resolvable = _bits(expected_indices >= 0)
    out_of_corpus = _bits(np.array([case["category"] == "hors_corpus" for case in cases]))
    true_ambiguous = _bits(
        np.array([case.get("ambiguityClassification") == "trueAmbiguous" for case in cases])
    )
    adjacent = _bits(
        np.array(
            [case.get("ambiguityClassification") == "adjacentButResolvable" for case in cases]
        )
    )
    heuristic_correct = _bits(np.array([case["heuristic"]["top1Correct"] for case in cases]))
    categories = _category_bits(cases)

    best_admissible = None
    best_v0 = None
    admissible_count = 0
    v0_count = 0
    evaluated = 0
    ranking_cache: dict[float, dict[str, Any]] = {}

    for weight_semantic in WEIGHT_SEMANTIC_VALUES:
        ranking = _ranking_for_weight(
            semantic_scores, lexical_scores, expected_indices, weight_semantic
        )
        ranking_cache[weight_semantic] = ranking
        masks = {
            "all": all_bits,
            "resolvable": resolvable,
            "nullExpected": all_bits ^ resolvable,
            "outOfCorpus": out_of_corpus,
            "trueAmbiguous": true_ambiguous,
            "adjacentButResolvable": adjacent,
            "heuristicCorrect": heuristic_correct,
            "rankingCorrect": _bits(ranking["top1Correct"]),
            "rankingTop3": _bits(ranking["top3Correct"]),
        }
        lexical_support_bits = _bits(ranking["topLexical"] >= lexical_support)
        lexical_high_bits = _bits(ranking["topLexical"] >= 1.0)
        high_masks = {
            threshold: _bits(ranking["topScores"] >= threshold)
            for threshold in HIGH_MATCH_VALUES
        }
        medium_masks = {
            threshold: _bits(ranking["topScores"] >= threshold)
            for threshold in MEDIUM_MATCH_VALUES
        }
        margin_masks = {
            threshold: _bits(ranking["margins"] >= threshold) for threshold in MARGIN_VALUES
        }
        semantic_masks = {
            threshold: all_bits
            if threshold is None
            else _bits(ranking["topSemantic"] >= threshold)
            for threshold in MINIMUM_SEMANTIC_VALUES
        }

        for high_threshold in HIGH_MATCH_VALUES:
            high_score = high_masks[high_threshold]
            for medium_threshold in MEDIUM_MATCH_VALUES:
                if medium_threshold >= high_threshold:
                    continue
                medium_score = medium_masks[medium_threshold] & lexical_support_bits
                score_acceptance = high_score | medium_score
                for margin_threshold in MARGIN_VALUES:
                    margin_ok = margin_masks[margin_threshold]
                    for minimum_semantic in MINIMUM_SEMANTIC_VALUES:
                        evaluated += 1
                        common = margin_ok & semantic_masks[minimum_semantic]
                        accepted = common & score_acceptance
                        high_path = common & high_score
                        configuration = {
                            "weightSemantic": weight_semantic,
                            "weightLexical": round(1 - weight_semantic, 3),
                            "highMatchThreshold": high_threshold,
                            "mediumMatchThreshold": medium_threshold,
                            "marginThreshold": margin_threshold,
                            "minimumSemantic": minimum_semantic,
                            "lexicalSupport": round(lexical_support, 6),
                        }
                        metrics = _configuration_metrics(
                            accepted=accepted,
                            high_path=high_path,
                            ranking=ranking,
                            masks=masks,
                            categories=categories,
                            lexical_high=lexical_high_bits,
                            configuration=configuration,
                        )
                        if (
                            metrics["dangerousNullExpectedAccepts"] != 0
                            or metrics["outOfCorpusFalsePositives"] > 3
                        ):
                            continue
                        admissible_count += 1
                        if best_admissible is None or _objective(metrics) > _objective(best_admissible):
                            best_admissible = metrics
                        if metrics["meetsV0"]:
                            v0_count += 1
                            if best_v0 is None or _objective(metrics) > _objective(best_v0):
                                best_v0 = metrics

    selected = best_v0 or best_admissible
    if selected is None:
        raise RuntimeError("No configuration satisfies zero dangerous false positives and OOC <= 15%")
    selected_ranking = ranking_cache[selected["configuration"]["weightSemantic"]]
    details = evaluate_selected_configuration(
        selected["configuration"], selected_ranking, cases, entry_ids, lexical_support
    )
    selected.update(details["metrics"])
    return {
        "grid": grid_contract(),
        "evaluatedConfigurations": evaluated,
        "admissibleConfigurations": admissible_count,
        "v0Configurations": v0_count,
        "selectedFromV0Set": best_v0 is not None,
        "selected": selected,
        "results": details["results"],
        "examples": details["examples"],
    }


def evaluate_selected_configuration(
    configuration: dict[str, Any],
    ranking: dict[str, Any],
    cases: list[dict[str, Any]],
    entry_ids: list[str],
    lexical_support: float,
) -> dict[str, Any]:
    high = ranking["topScores"] >= configuration["highMatchThreshold"]
    medium = (
        (ranking["topScores"] >= configuration["mediumMatchThreshold"])
        & (ranking["topLexical"] >= lexical_support)
    )
    margin_ok = ranking["margins"] >= configuration["marginThreshold"]
    semantic_ok = (
        np.ones(len(cases), dtype=bool)
        if configuration["minimumSemantic"] is None
        else ranking["topSemantic"] >= configuration["minimumSemantic"]
    )
    accepted = semantic_ok & margin_ok & (high | medium)
    high_path = accepted & high
    rows = np.arange(len(cases))
    results = []
    for index, case in enumerate(cases):
        order = ranking["order"][index]
        top = int(order[0])
        second = int(order[1])
        expected = case.get("expectedEntryId")
        correct = bool(accepted[index] and entry_ids[top] == expected)
        severity = None
        if accepted[index] and expected is None:
            if high_path[index] or ranking["topLexical"][index] >= 1.0:
                severity = "dangerous"
            elif ranking["topLexical"][index] >= lexical_support:
                severity = "medium"
            else:
                severity = "weak"
        results.append(
            {
                "case": case,
                "outcome": "matched" if accepted[index] else "abstained",
                "matchedEntryId": entry_ids[top] if accepted[index] else None,
                "correct": correct if expected is not None else not bool(accepted[index]),
                "gatePath": "high" if high_path[index] else ("mediumLexical" if accepted[index] else None),
                "severity": severity,
                "top1": {
                    "entryId": entry_ids[top],
                    "combinedScore": round(float(ranking["topScores"][index]), 6),
                    "semanticScore": round(float(ranking["topSemantic"][index]), 6),
                    "lexicalScore": round(float(ranking["topLexical"][index]), 6),
                },
                "top2": {
                    "entryId": entry_ids[second],
                    "combinedScore": round(float(ranking["combined"][index, second]), 6),
                },
                "marginTop1Top2": round(float(ranking["margins"][index]), 6),
                "top3EntryIds": [entry_ids[int(item)] for item in order[:3]],
            }
        )

    resolvable = [result for result in results if result["case"].get("expectedEntryId")]
    categories: dict[str, dict[str, int | float]] = {}
    for category in dict.fromkeys(result["case"]["category"] for result in results):
        group = [result for result in results if result["case"]["category"] == category]
        positives = [result for result in group if result["case"].get("expectedEntryId")]
        correct = sum(result["correct"] for result in positives)
        top3 = sum(
            result["case"].get("expectedEntryId") in result["top3EntryIds"] for result in positives
        )
        categories[category] = {
            "cases": len(group),
            "positives": len(positives),
            "correct": correct,
            "top1Rate": _rate(correct, len(positives)),
            "top3": top3,
            "top3Rate": _rate(top3, len(positives)),
            "abstained": sum(result["outcome"] == "abstained" for result in group),
        }

    corrections = [
        result
        for result in resolvable
        if not result["case"]["heuristic"]["top1Correct"] and result["correct"]
    ]
    new_errors = [
        result
        for result in resolvable
        if result["case"]["heuristic"]["top1Correct"] and not result["correct"]
    ]
    out_of_corpus_false_positives = [
        result
        for result in results
        if result["case"]["category"] == "hors_corpus" and result["outcome"] == "matched"
    ]
    true_ambiguous = [
        result
        for result in results
        if result["case"].get("ambiguityClassification") == "trueAmbiguous"
    ]
    over_abstentions = [
        result for result in resolvable if result["outcome"] == "abstained"
    ]
    metrics = {
        "byCategory": categories,
        "falsePositiveSeverity": {
            severity: sum(result["severity"] == severity for result in out_of_corpus_false_positives)
            for severity in ("weak", "medium", "dangerous")
        },
        "heuristicFailuresCorrected": len(corrections),
        "newErrorsVersusHeuristic": len(new_errors),
        "overAbstentions": len(over_abstentions),
        "trueAmbiguousAbstentions": sum(
            result["outcome"] == "abstained" for result in true_ambiguous
        ),
        "trueAmbiguousErrors": sum(result["outcome"] == "matched" for result in true_ambiguous),
        "outOfCorpusFalsePositives": len(out_of_corpus_false_positives),
        "outOfCorpusAbstentions": 20 - len(out_of_corpus_false_positives),
    }
    return {
        "metrics": metrics,
        "results": results,
        "examples": {
            "heuristicFailuresCorrected": corrections[:8],
            "newErrorsVersusHeuristic": new_errors[:8],
            "overAbstentions": sorted(
                over_abstentions, key=lambda result: (-result["top1"]["combinedScore"], result["case"]["id"])
            )[:8],
            "trueAmbiguous": true_ambiguous,
            "outOfCorpusFalsePositives": out_of_corpus_false_positives,
        },
    }
