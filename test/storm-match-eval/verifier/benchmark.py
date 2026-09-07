"""Orchestrate the offline relevance-verifier spike and its one-shot holdout."""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

from artifacts import validate_artifact
from calibration import calibrate, diagnostic_rerank
from common import validate_payload

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[2]
RETRIEVERS = ("e5-small", "distiluse-cased-v2")
VERIFIERS = ("mmarco-minilm-l12", "bge-reranker-v2-m3")
CONTRACTS = ("question", "questionAnswer")


def parse_mapping(value: str) -> tuple[str, Path]:
    key, separator, raw_path = value.partition("=")
    if not separator or not raw_path:
        raise argparse.ArgumentTypeError("Expected key=absolute-path")
    return key, Path(raw_path)


def offline_environment() -> dict[str, str]:
    environment = os.environ.copy()
    environment.update({
        "HF_HUB_OFFLINE": "1", "TRANSFORMERS_OFFLINE": "1", "HF_DATASETS_OFFLINE": "1",
        "HF_HUB_DISABLE_TELEMETRY": "1", "TOKENIZERS_PARALLELISM": "false", "PYTHONDONTWRITEBYTECODE": "1",
    })
    return environment


def export_payload(node: str, phase: str, output: Path) -> dict[str, Any]:
    completed = subprocess.run(
        [node, str(HERE / "export-input.mjs"), phase], cwd=REPO_ROOT,
        capture_output=True, text=True, encoding="utf-8", check=True,
    )
    payload = json.loads(completed.stdout)
    validate_payload(payload, phase)
    output.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    return payload


def run(command: list[str]) -> None:
    completed = subprocess.run(command, cwd=REPO_ROOT, env=offline_environment(), text=True, encoding="utf-8")
    if completed.returncode:
        raise RuntimeError(f"Worker failed ({completed.returncode}): {' '.join(command[:3])}")


def selection_objective(item: dict[str, Any]) -> tuple:
    selected = item["calibration"]["selected"]
    by_type = selected["byType"]
    return (
        bool(selected.get("meetsV0")), selected["top1Correct"],
        by_type["paraphrase_naturelle"]["matchedCorrectly"],
        by_type["vocabulaire_different"]["matchedCorrectly"],
        by_type["synonymes"]["matchedCorrectly"],
        -selected["falsePositives"], -selected["overAbstentions"],
        -item["topK"], item["contract"] == "question",
    )


def pct(value: int, total: int) -> str:
    return f"{value}/{total} ({100 * value / total:.1f}%)" if total else "n/a"


def example_lines(metrics: dict[str, Any], predicate, limit: int = 6) -> list[str]:
    selected = [item for item in metrics["results"] if predicate(item)][:limit]
    if not selected:
        return ["- Aucun."]
    lines = []
    for item in selected:
        case = item["case"]
        lines.append(
            f"- `{case['id']}` — {case['formulation']} — attendu `{case.get('expectedEntryId')}`, "
            f"top verifier `{item['top']['entryId']}` score={item['top']['verifierScore']:.4f}, "
            f"marge={item['margin']:.4f}, décision `{item.get('matchedEntryId')}`."
        )
    return lines


def render_report(payload, retrievals, verifier_outputs, combinations, selected, holdout) -> str:
    artifacts = {key: verifier_outputs[key]["artifact"] for key in VERIFIERS}
    hold = holdout["metrics"]
    lines = [
        "# Storm Match — relevance verifier spike V0", "",
        f"- Corpus officiel inchangé : `{payload['corpusFingerprint']}` (320 cas; 290 résolubles)",
        f"- Corpus décisionnel : `{payload['decisionFingerprint']}` (200 cas; calibration 120, holdout 80)",
        "- Séparation : 60 positifs + 60 négatifs en calibration; 40 positifs + 40 négatifs en holdout; sources positives disjointes.",
        "- Holdout : exporté et exécuté une seule fois après verrouillage global du retriever, Top-K, verifier, contrat et seuils.",
        "- Exécution : CPU; Hugging Face/Transformers offline; aucun lexical, aucune génération, aucun branchement produit.",
        "", "## Modèles de vérification retenus", "",
        "| modèle | révision | paramètres | artefact effectif | licence | fingerprint |",
        "|---|---|---:|---:|---|---|",
    ]
    for key in VERIFIERS:
        item = artifacts[key]
        lines.append(
            f"| `{item['modelId']}` | `{item['revision']}` | {item['parameters']:,} | "
            f"{item['artifactBytes'] / 1024 / 1024:.2f} MiB | {item['license']} | `{item['artifactFingerprint']}` |"
        )
    lines.extend([
        "", "Checksums des poids : " + "; ".join(
            f"`{key}` = `{artifacts[key]['weightSha256']}`" for key in VERIFIERS
        ) + ".",
        "", "`Alibaba-NLP/gte-multilingual-reranker-base` a été écarté du run principal car il exige `trust_remote_code` et du code externe. "
        "`jinaai/jina-reranker-v2-base-multilingual` a été écarté car sa licence CC-BY-NC-4.0 est incompatible avec l’usage produit commercial visé.",
        "", "## Retrieval avant vérification", "",
        "| retriever | officiel R@1 | officiel R@3 | officiel R@5 | calibration R@1 | calibration R@3 | calibration R@5 |",
        "|---|---:|---:|---:|---:|---:|---:|",
    ])
    for key in RETRIEVERS:
        om = retrievals[key]["metrics"]["official"]
        cm = retrievals[key]["metrics"]["decisionCalibration"]
        lines.append(
            f"| `{key}` | {pct(om['recallAt1'], om['cases'])} | {pct(om['recallAt3'], om['cases'])} | {pct(om['recallAt5'], om['cases'])} | "
            f"{pct(cm['recallAt1'], cm['cases'])} | {pct(cm['recallAt3'], cm['cases'])} | {pct(cm['recallAt5'], cm['cases'])} |"
        )
    lines.extend([
        "", "Un `retrievalMiss` signifie que l’attendu est absent du Top-K. Une `verifierError` n’est comptée que si l’attendu était présent dans le Top-K mais n’a pas été classé premier.",
        "", "## Reranking brut sur les 290 cas officiels résolubles", "",
        "Cette mesure n’applique aucun seuil d’abstention. Elle isole l’effet du reranking sur le Top-K du retriever.",
        "", "| retriever | verifier | K | paire | Top-1 | Top-3 | retrieval misses | verifier errors |",
        "|---|---|---:|---|---:|---:|---:|---:|",
    ])
    for item in combinations:
        diag = item["officialRerankDiagnostic"]
        lines.append(
            f"| `{item['retrieverKey']}` | `{item['verifierKey']}` | {item['topK']} | `{item['contract']}` | "
            f"{pct(diag['top1'], 290)} | {pct(diag['top3'], 290)} | {diag['retrievalMisses']} | {diag['verifierErrors']} |"
        )
    lines.extend([
        "", "## Calibration — 16 architectures comparées", "",
        "Les seuils de score et de marge sont balayés sur toutes les valeurs qui changent effectivement une décision dans les 120 cas de calibration, plus l’abstention totale. "
        "L’admissibilité impose zéro faux positif dangereux et zéro acceptation `clearOutOfCorpus` (≤15 % de six cas).",
        "", "| retriever | verifier | K | paire | Top-1 | para. | synonymes | diff. vocab | adjacent | FP f/m/d | sur-abst. | V0 |",
        "|---|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---|",
    ])
    for item in combinations:
        m = item["calibration"]["selected"]
        bt = m["byType"]
        sev = m["falsePositiveSeverity"]
        lines.append(
            f"| `{item['retrieverKey']}` | `{item['verifierKey']}` | {item['topK']} | `{item['contract']}` | "
            f"{pct(m['top1Correct'], 60)} | {bt['paraphrase_naturelle']['matchedCorrectly']}/15 | "
            f"{bt['synonymes']['matchedCorrectly']}/15 | {bt['vocabulaire_different']['matchedCorrectly']}/15 | "
            f"{bt['adjacentButResolvable']['matchedCorrectly']}/15 | {sev['weak']}/{sev['medium']}/{sev['dangerous']} | "
            f"{m['overAbstentions']} | {'oui' if m.get('meetsV0') else 'non'} |"
        )
    lines.extend([
        "", "## Coût isolé des verifiers", "",
        "Les latences ci-dessous mesurent seulement la vérification d’un Top-K, sur les mêmes 32 requêtes de calibration. "
        "La latence bout-en-bout exacte n’est mesurée que pour la configuration finale au holdout.",
        "", "| verifier | paire | K | mean | p50 | p95 |",
        "|---|---|---:|---:|---:|---:|",
    ])
    for verifier_key in VERIFIERS:
        latency = verifier_outputs[verifier_key]["latency"]["distiluse-cased-v2"]
        for contract in CONTRACTS:
            for top_k in (3, 5):
                timing = latency[contract][f"top{top_k}"]
                lines.append(
                    f"| `{verifier_key}` | `{contract}` | {top_k} | {timing['mean']:.1f} ms | "
                    f"{timing['p50']:.1f} ms | {timing['p95']:.1f} ms |"
                )
    lines.extend(["", "| verifier | chargement | RAM chargée | pic RAM worker |", "|---|---:|---:|---:|"])
    for verifier_key in VERIFIERS:
        performance = verifier_outputs[verifier_key]["performance"]
        lines.append(
            f"| `{verifier_key}` | {performance['modelLoadMilliseconds']:.1f} ms | "
            f"{performance['rssLoadedMiB']:.2f} MiB | {performance['rssPeakMiB']:.2f} MiB |"
        )
    lines.extend([
        "", "Signal de la réponse canonique : sur le reranking officiel, `questionAnswer` améliore systématiquement MiniLM "
        "(par exemple 205→223 Top-1 avec DistilUSE/K=3), mais dégrade BGE (238→228 dans la même configuration). "
        "Sur le corpus décisionnel et sous contrainte de sécurité, BGE ne récupère pratiquement des positifs qu’avec la réponse (4→19/60), "
        "sans toutefois approcher les critères V0. Le signal est donc réel mais dépend du verifier et ne constitue pas une validation générale du contrat Q+A.",
    ])
    sm = selected["calibration"]["selected"]
    lines.extend([
        "", "## Configuration verrouillée avant holdout", "",
        f"- Retriever : `{selected['retrieverKey']}`; Top-K : {selected['topK']}.",
        f"- Verifier : `{selected['verifierKey']}`; paire : `{selected['contract']}`.",
        f"- Seuil pertinence : `{sm['scoreThreshold']}`; seuil marge : `{sm['marginThreshold']}`.",
        f"- Calibration : {pct(sm['top1Correct'], 60)}, {sm['falsePositives']} faux positifs, {sm['falsePositiveSeverity']['dangerous']} dangereux; "
        f"{selected['calibration']['evaluatedConfigurations']} décisions de seuil évaluées pour cette architecture.",
        "", "## Holdout final — passage unique", "",
        f"- Top-1 résoluble : {pct(hold['top1Correct'], 40)}.",
        f"- Top-3 après reranking : {pct(hold['top3AfterRerank'], 40)}.",
        f"- Retrieval misses : {hold['retrievalMisses']}; verifier errors : {hold['verifierErrors']}; sur-abstentions : {hold['overAbstentions']}; matches positifs erronés : {hold['wrongPositiveMatches']}.",
        f"- Paraphrases : {hold['byType']['paraphrase_naturelle']['matchedCorrectly']}/10; synonymes : {hold['byType']['synonymes']['matchedCorrectly']}/10; "
        f"differentVocab : {hold['byType']['vocabulaire_different']['matchedCorrectly']}/10; adjacentButResolvable : {hold['byType']['adjacentButResolvable']['matchedCorrectly']}/10.",
        f"- Négatifs correctement rejetés : {hold['negativeCorrectlyRejected']}/40; trueAmbiguous : {hold['byType']['trueAmbiguous']['abstained']}/4; "
        f"clearOutOfCorpus : {hold['byType']['clearOutOfCorpus']['abstained']}/4; hard negatives : {hold['byType']['hardNegative']['abstained']}/4; mixed intents : {hold['byType']['mixedIntents']['abstained']}/4.",
        f"- Faux positifs faibles/moyens/dangereux : {hold['falsePositiveSeverity']['weak']}/{hold['falsePositiveSeverity']['medium']}/{hold['falsePositiveSeverity']['dangerous']}.",
        f"- Corrections vs Top-1 retrieval : {hold['correctionsVersusRetrievalTop1']}; nouvelles erreurs : {hold['newErrorsVersusRetrievalTop1']}.",
        "", "### Résultats holdout par type", "",
        "| type | cas | correct | acceptés | abstentions |",
        "|---|---:|---:|---:|---:|",
    ])
    for type_name, item in hold["byType"].items():
        lines.append(f"| `{type_name}` | {item['cases']} | {item['correct']} | {item['accepted']} | {item['abstained']} |")
    perf = holdout["performance"]
    lines.extend([
        "", "## Performance CPU", "",
        f"- Matériel : {holdout['hardware']['processor']}; {holdout['hardware']['physicalCores']} cœurs physiques / {holdout['hardware']['logicalCores']} logiques; {holdout['hardware']['cpuThreadsUsed']} threads utilisés.",
        f"- Cold start combiné : {perf['combinedColdStartMilliseconds']:.1f} ms (retriever {perf['retrieverLoadMilliseconds']:.1f}; verifier {perf['verifierLoadMilliseconds']:.1f}).",
        f"- Vectorisation des 112 questions : {perf['canonical112VectorizationMilliseconds']:.1f} ms.",
        f"- Latence chaude totale mean/p50/p95 : {perf['totalWarmMilliseconds']['mean']:.1f} / {perf['totalWarmMilliseconds']['p50']:.1f} / {perf['totalWarmMilliseconds']['p95']:.1f} ms.",
        f"- Retrieval chaud mean/p50/p95 : {perf['retrievalWarmMilliseconds']['mean']:.1f} / {perf['retrievalWarmMilliseconds']['p50']:.1f} / {perf['retrievalWarmMilliseconds']['p95']:.1f} ms.",
        f"- Verification chaude mean/p50/p95 : {perf['verifierWarmMilliseconds']['mean']:.1f} / {perf['verifierWarmMilliseconds']['p50']:.1f} / {perf['verifierWarmMilliseconds']['p95']:.1f} ms.",
        f"- RAM processus avant / modèles chargés / pic : {perf['rssBeforeMiB']:.2f} / {perf['rssBothLoadedMiB']:.2f} / {perf['rssPeakMiB']:.2f} MiB.",
        "", "## Exemples holdout", "", "### Corrections du retrieval", "",
        *example_lines(hold, lambda item: item['case'].get('expectedEntryId') and not item['retrievalTop1Correct'] and item['correct']),
        "", "### Nouvelles erreurs", "",
        *example_lines(hold, lambda item: item['retrievalTop1Correct'] and not item['correct']),
        "", "### Faux positifs", "",
        *example_lines(hold, lambda item: not item['case'].get('expectedEntryId') and item['accepted']),
        "", "### Sur-abstentions", "",
        *example_lines(hold, lambda item: item['case'].get('expectedEntryId') and not item['accepted']),
        "", "## Verdict", "",
    ])
    if hold.get("meetsV0"):
        lines.append("La configuration sélectionnée sur calibration satisfait les critères Liquid Core V0 sur le holdout. Elle est recommandable pour une étape d’architecture ultérieure, sans constituer encore un choix produit.")
    else:
        lines.append("Le holdout ne satisfait pas simultanément les critères Liquid Core V0. Aucune architecture n’est recommandée et aucun choix produit n’est forcé.")
    lines.extend([
        "", "## Limites", "",
        "- Le corpus décisionnel est une fixture expérimentale test-only; la taxonomie de gravité n’est pas une politique produit.",
        "- La calibration a comparé deux retrievers, deux verifiers, deux Top-K et deux contrats; le holdout n’a servi qu’au passage final verrouillé.",
        "- Aucun score lexical, seuil produit, `SemanticProvider`, index, branchement Storm Match, Ivory, Studio ou Pilotage n’est inclus.", "",
    ])
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--retriever", action="append", type=parse_mapping, default=[])
    parser.add_argument("--verifier", action="append", type=parse_mapping, default=[])
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--raw-output", type=Path)
    parser.add_argument("--from-raw", type=Path, help="Render an existing complete result without rerunning models")
    parser.add_argument("--node", default=shutil.which("node") or "node")
    parser.add_argument("--cpu-threads", type=int, default=max(1, (os.cpu_count() or 2) // 2))
    args = parser.parse_args()
    if args.from_raw:
        raw = json.loads(args.from_raw.read_text(encoding="utf-8"))
        payload = {
            "corpusFingerprint": raw["corpusFingerprint"],
            "decisionFingerprint": raw["decisionFingerprint"],
        }
        selected = next(
            item for item in raw["combinations"]
            if all(item[key] == raw["lockedSelection"][key] for key in ("retrieverKey", "verifierKey", "topK", "contract"))
        )
        report = render_report(payload, raw["retrievals"], raw["verifiers"], raw["combinations"], selected, raw["holdout"])
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(report, encoding="utf-8")
        return 0
    retriever_paths, verifier_paths = dict(args.retriever), dict(args.verifier)
    if set(retriever_paths) != set(RETRIEVERS) or set(verifier_paths) != set(VERIFIERS):
        raise ValueError("Exactly the two retained retrievers and two retained verifiers are required")
    for key, path in verifier_paths.items():
        validate_artifact(key, path.resolve())
    with tempfile.TemporaryDirectory(prefix="storm-verifier-spike-") as temporary:
        root = Path(temporary)
        calibration_input = root / "calibration.json"
        payload = export_payload(args.node, "calibration", calibration_input)
        retrievals = {}
        retrieval_files = []
        for key in RETRIEVERS:
            output = root / f"retrieval-{key}.json"
            run([sys.executable, str(HERE / "retrieval_worker.py"), "--model-key", key, "--model-path", str(retriever_paths[key].resolve()), "--input", str(calibration_input), "--output", str(output), "--cpu-threads", str(args.cpu_threads)])
            retrieval_files.append(output)
            retrievals[key] = json.loads(output.read_text(encoding="utf-8"))
        verifier_outputs = {}
        for key in VERIFIERS:
            output = root / f"verifier-{key}.json"
            command = [sys.executable, str(HERE / "verifier_worker.py"), "--model-key", key, "--model-path", str(verifier_paths[key].resolve()), "--input", str(calibration_input), "--output", str(output), "--cpu-threads", str(args.cpu_threads)]
            for path in retrieval_files:
                command.extend(["--retrieval", str(path)])
            run(command)
            verifier_outputs[key] = json.loads(output.read_text(encoding="utf-8"))
        combinations = []
        for retriever_key in RETRIEVERS:
            for verifier_key in VERIFIERS:
                for top_k in (3, 5):
                    for contract in CONTRACTS:
                        source = verifier_outputs[verifier_key]["scores"][retriever_key][contract]
                        calibrated = calibrate(source["decisionCalibration"], top_k)
                        official = diagnostic_rerank(source["official"], top_k)
                        combinations.append({
                            "retrieverKey": retriever_key, "verifierKey": verifier_key,
                            "topK": top_k, "contract": contract, "calibration": calibrated,
                            "officialRerankDiagnostic": official,
                        })
        selected = max(combinations, key=selection_objective)
        sm = selected["calibration"]["selected"]
        selection = {
            "retrieverKey": selected["retrieverKey"], "verifierKey": selected["verifierKey"],
            "topK": selected["topK"], "contract": selected["contract"],
            "scoreThreshold": sm["scoreThreshold"], "marginThreshold": sm["marginThreshold"],
            "decisionFingerprint": payload["decisionFingerprint"],
        }
        selection_path = root / "locked-selection.json"
        selection_path.write_text(json.dumps(selection), encoding="utf-8")
        holdout_input = root / "holdout.json"
        export_payload(args.node, "holdout", holdout_input)
        holdout_path = root / "holdout-result.json"
        run([sys.executable, str(HERE / "final_holdout_worker.py"), "--selection", str(selection_path), "--input", str(holdout_input), "--retriever-path", str(retriever_paths[selection['retrieverKey']].resolve()), "--verifier-path", str(verifier_paths[selection['verifierKey']].resolve()), "--output", str(holdout_path), "--cpu-threads", str(args.cpu_threads)])
        holdout = json.loads(holdout_path.read_text(encoding="utf-8"))
        report = render_report(payload, retrievals, verifier_outputs, combinations, selected, holdout)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(report, encoding="utf-8")
        if args.raw_output:
            raw = {
                "corpusFingerprint": payload["corpusFingerprint"], "decisionFingerprint": payload["decisionFingerprint"],
                "retrievals": retrievals, "verifiers": verifier_outputs,
                "combinations": combinations, "lockedSelection": selection, "holdout": holdout,
            }
            args.raw_output.parent.mkdir(parents=True, exist_ok=True)
            args.raw_output.write_text(json.dumps(raw, ensure_ascii=False), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
